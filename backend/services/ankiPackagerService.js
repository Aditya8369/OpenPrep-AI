/**
 * Anki (.apkg) Deck Importer & Exporter Service
 * Implements SQLite database packaging and ZIP archive bundle
 * with zero required third-party binaries (uses built-in node:sqlite and node:zlib,
 * with better-sqlite3 / adm-zip / archiver fallback).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');

// Helper to open SQLite DB synchronously
function openSqliteDatabase(filePath) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(filePath);
  } catch (err1) {
    try {
      const BetterSqlite3 = require('better-sqlite3');
      return new BetterSqlite3(filePath);
    } catch (err2) {
      throw new Error(`Failed to load SQLite engine: ${err1.message} / ${err2.message}`);
    }
  }
}

/**
 * Creates a standard ZIP buffer containing the provided files
 * @param {Array<{name: string, data: Buffer|string}>} files
 * @returns {Buffer}
 */
function createZipArchive(files) {
  const buffers = [];
  const cdEntries = [];
  let offset = 0;

  for (const file of files) {
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const compressed = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(file.name);
    const crc = zlib.crc32 ? zlib.crc32(data) : 0;

    // Local file header (30 bytes + name)
    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    lfh.writeUInt16LE(20, 4);         // version needed: 2.0
    lfh.writeUInt16LE(0, 6);          // flags
    lfh.writeUInt16LE(8, 8);          // compression: 8 = Deflate
    lfh.writeUInt16LE(0, 10);         // mod time
    lfh.writeUInt16LE(0, 12);         // mod date
    lfh.writeUInt32LE(crc, 14);       // crc32
    lfh.writeUInt32LE(compressed.length, 18); // comp size
    lfh.writeUInt32LE(data.length, 22);       // uncomp size
    lfh.writeUInt16LE(nameBuf.length, 26);    // filename length
    lfh.writeUInt16LE(0, 28);                 // extra field length
    nameBuf.copy(lfh, 30);

    buffers.push(lfh);
    buffers.push(compressed);

    // Central Directory Entry (46 bytes + name)
    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);  // PK\x01\x02
    cd.writeUInt16LE(20, 4);          // version made by
    cd.writeUInt16LE(20, 6);          // version needed
    cd.writeUInt16LE(0, 8);           // flags
    cd.writeUInt16LE(8, 10);          // compression: 8 = Deflate
    cd.writeUInt16LE(0, 12);          // mod time
    cd.writeUInt16LE(0, 14);          // mod date
    cd.writeUInt32LE(crc, 16);        // crc32
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);          // extra len
    cd.writeUInt16LE(0, 32);          // comment len
    cd.writeUInt16LE(0, 34);          // disk start
    cd.writeUInt16LE(0, 36);          // internal attrs
    cd.writeUInt32LE(0, 38);          // external attrs
    cd.writeUInt32LE(offset, 42);     // relative offset
    nameBuf.copy(cd, 46);

    cdEntries.push(cd);
    offset += lfh.length + compressed.length;
  }

  const cdBuffer = Buffer.concat(cdEntries);

  // End of Central Directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);  // PK\x05\x06
  eocd.writeUInt16LE(0, 4);           // disk number
  eocd.writeUInt16LE(0, 6);           // disk with CD
  eocd.writeUInt16LE(files.length, 8); // entries on disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(cdBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...buffers, cdBuffer, eocd]);
}

/**
 * Extracts files from a ZIP buffer
 * @param {Buffer} buffer
 * @returns {Record<string, Buffer>}
 */
function extractZipArchive(buffer) {
  const files = {};
  let i = 0;
  while (i <= buffer.length - 30) {
    if (buffer.readUInt32LE(i) === 0x04034b50) {
      const compression = buffer.readUInt16LE(i + 8);
      const compSize = buffer.readUInt32LE(i + 18);
      const uncompSize = buffer.readUInt32LE(i + 22);
      const nameLen = buffer.readUInt16LE(i + 26);
      const extraLen = buffer.readUInt16LE(i + 28);
      const name = buffer.toString('utf8', i + 30, i + 30 + nameLen);
      const dataStart = i + 30 + nameLen + extraLen;
      const compData = buffer.subarray(dataStart, dataStart + compSize);

      let content;
      if (compression === 0) {
        content = compData;
      } else if (compression === 8) {
        content = zlib.inflateRawSync(compData);
      } else {
        throw new Error(`Unsupported zip compression method: ${compression}`);
      }
      files[name] = content;
      i = dataStart + compSize;
    } else {
      i++;
    }
  }
  return files;
}

/**
 * Generates an Anki .apkg package buffer from cards
 * @param {Array<{front: string, back: string, hint?: string, interval?: number, easeFactor?: number, efactor?: number, repetitions?: number, tags?: Array<string>|string}>} cards
 * @param {string} deckName
 * @returns {Promise<Buffer>}
 */
async function generateAnkiPackage(cards = [], deckName = 'OpenPrep AI Deck') {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anki_export_'));
  const dbPath = path.join(tempDir, 'collection.anki2');

  try {
    const db = openSqliteDatabase(dbPath);

    // Create standard Anki SQLite schema
    db.exec(`
      CREATE TABLE col (
        id INTEGER PRIMARY KEY,
        crt INTEGER,
        mod INTEGER,
        scm INTEGER,
        ver INTEGER,
        dty INTEGER,
        usn INTEGER,
        ls INTEGER,
        conf TEXT,
        models TEXT,
        decks TEXT,
        dconf TEXT,
        tags TEXT
      );

      CREATE TABLE notes (
        id INTEGER PRIMARY KEY,
        guid TEXT,
        mid INTEGER,
        mod INTEGER,
        usn INTEGER,
        tags TEXT,
        flds TEXT,
        sfld INTEGER,
        csum INTEGER,
        flags INTEGER,
        data TEXT
      );

      CREATE TABLE cards (
        id INTEGER PRIMARY KEY,
        nid INTEGER,
        did INTEGER,
        ord INTEGER,
        mod INTEGER,
        usn INTEGER,
        type INTEGER,
        queue INTEGER,
        due INTEGER,
        ivl INTEGER,
        factor INTEGER,
        reps INTEGER,
        lapses INTEGER,
        left INTEGER,
        odue INTEGER,
        odid INTEGER,
        flags INTEGER,
        data TEXT
      );
    `);

    const now = Math.floor(Date.now() / 1000);
    const deckId = 1;
    const modelId = 1;

    const conf = JSON.stringify({
      activeDecks: [deckId],
      curDeck: deckId,
      newSpread: 0,
      collapseTime: 1200,
      timeLim: 0,
      estFreq: 0,
      nextPos: 1,
    });

    const models = JSON.stringify({
      [modelId]: {
        id: modelId,
        name: 'Basic',
        type: 0,
        mod: now,
        usn: 0,
        sortf: 0,
        did: deckId,
        tmpls: [
          {
            name: 'Card 1',
            ord: 0,
            qfmt: '{{Front}}',
            afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}',
            did: null,
            bqfmt: '',
            bafmt: '',
          },
        ],
        flds: [
          { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20 },
          { name: 'Back', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20 },
        ],
        css: '.card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }',
      },
    });

    const decks = JSON.stringify({
      [deckId]: {
        id: deckId,
        name: deckName,
        desc: 'Generated by OpenPrep AI Spaced Repetition Packager',
        mod: now,
        usn: 0,
        collapsed: false,
        browserCollapsed: false,
        conf: 1,
        extendNew: 10,
        extendRev: 50,
      },
    });

    const dconf = JSON.stringify({
      1: {
        id: 1,
        mod: now,
        name: 'Default',
        usn: 0,
        maxTaken: 60,
        autoplay: true,
        timer: 0,
        replayq: true,
        new: { delays: [1, 10], ints: [1, 4, 7], initialFactor: 2500, separate: true, order: 1, perDay: 20 },
        rev: { perDay: 200, ease4: 1.3, ivlFct: 1, maxIvl: 36500, minSpace: 1, fuzz: 0.05 },
        lapse: { delays: [10], mult: 0, minInt: 1, leechFails: 8, leechAction: 0 },
      },
    });

    const insertCol = db.prepare(
      `INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertCol.run(1, now, now, now, 11, 0, 0, 0, conf, models, decks, dconf, '{}');

    const insertNote = db.prepare(
      `INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertCard = db.prepare(
      `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let noteId = 1500000000000;
    let cardId = 1500000000000;

    for (const card of cards) {
      noteId += Math.floor(Math.random() * 10) + 1;
      cardId += Math.floor(Math.random() * 10) + 1;

      const guid = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
      let backContent = card.back || '';
      if (card.hint) {
        backContent += `<br><br><span style="color: #64748b; font-size: 0.9em;"><em>Hint:</em> ${card.hint}</span>`;
      }

      // Anki uses \x1f (Unit Separator) to delimit fields
      const flds = `${card.front || ''}\x1f${backContent}`;
      const sfld = card.front || '';

      // Checksum of front field
      const hash = crypto.createHash('sha1').update(sfld).digest();
      const csum = hash.readUInt32BE(0);

      const tags = Array.isArray(card.tags) ? card.tags.join(' ') : (card.tags || '');

      insertNote.run(noteId, guid, modelId, now, 0, tags ? ` ${tags} ` : '', flds, sfld, csum, 0, '');

      const ease = card.easeFactor || card.efactor || 2.5;
      const factor = Math.round(ease * 1000);
      const ivl = Math.max(1, card.interval || 1);
      const reps = card.repetitions || 0;

      insertCard.run(
        cardId,
        noteId,
        deckId,
        0,     // ord
        now,   // mod
        0,     // usn
        reps > 0 ? 2 : 0, // type: 0=new, 1=learning, 2=review
        reps > 0 ? 2 : 0, // queue
        reps > 0 ? ivl : 1, // due
        ivl,   // ivl
        factor,
        reps,
        0,     // lapses
        0,     // left
        0,     // odue
        0,     // odid
        0,     // flags
        ''     // data
      );
    }

    if (typeof db.close === 'function') {
      db.close();
    }

    const sqliteBuffer = fs.readFileSync(dbPath);
    const mediaBuffer = Buffer.from('{}', 'utf8');

    // Create compressed .apkg ZIP archive containing collection.anki2 and media
    const apkgBuffer = createZipArchive([
      { name: 'collection.anki2', data: sqliteBuffer },
      { name: 'media', data: mediaBuffer },
    ]);

    return apkgBuffer;
  } finally {
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Parses an uploaded .apkg buffer and extracts card notes & deck info
 * @param {Buffer} apkgBuffer
 * @returns {Promise<{deckName: string, cards: Array<{front: string, back: string, hint?: string, tags: Array<string>, interval: number, easeFactor: number, repetitions: number}>}>}
 */
async function parseAnkiPackage(apkgBuffer) {
  if (!Buffer.isBuffer(apkgBuffer)) {
    throw new Error('Expected buffer for anki package parsing');
  }

  const files = extractZipArchive(apkgBuffer);
  const sqliteData = files['collection.anki2'] || files['collection.anki21'];

  if (!sqliteData) {
    throw new Error('Invalid .apkg archive: collection.anki2 not found');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anki_import_'));
  const dbPath = path.join(tempDir, 'collection.anki2');
  fs.writeFileSync(dbPath, sqliteData);

  try {
    const db = openSqliteDatabase(dbPath);

    // Extract deck name from col table
    let deckName = 'Imported Anki Deck';
    try {
      const colRow = db.prepare('SELECT decks FROM col LIMIT 1').get();
      if (colRow && colRow.decks) {
        const decksMap = JSON.parse(colRow.decks);
        const deckKeys = Object.keys(decksMap).filter((k) => k !== '1' || Object.keys(decksMap).length === 1);
        const activeKey = deckKeys[0] || '1';
        if (decksMap[activeKey] && decksMap[activeKey].name) {
          deckName = decksMap[activeKey].name;
        }
      }
    } catch (e) {
      console.warn('Could not extract deck name from Anki collection:', e.message);
    }

    // Query cards and notes
    let notes = [];
    try {
      notes = db.prepare(`
        SELECT n.id, n.tags, n.flds, c.ivl, c.factor, c.reps
        FROM notes n
        LEFT JOIN cards c ON c.nid = n.id
      `).all();
    } catch {
      notes = db.prepare(`SELECT id, tags, flds FROM notes`).all();
    }

    if (typeof db.close === 'function') {
      db.close();
    }

    const cards = (notes || []).map((row) => {
      const flds = (row.flds || '').split('\x1f');
      const front = (flds[0] || '').trim();
      let back = (flds[1] || '').trim();
      let hint = '';

      // Check if back contains hint markup
      const hintMatch = back.match(/<em>Hint:<\/em>\s*(.*?)(<\/span>|$)/i);
      if (hintMatch) {
        hint = hintMatch[1].trim();
        back = back.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<span[^>]*><em>Hint:<\/em>.*?<\/span>/gi, '').trim();
      }

      // Clean HTML tags from back if simple
      const rawTags = (row.tags || '').trim().split(/\s+/).filter(Boolean);
      const interval = typeof row.ivl === 'number' && row.ivl > 0 ? row.ivl : 1;
      const easeFactor = typeof row.factor === 'number' && row.factor > 0 ? Math.round((row.factor / 1000) * 100) / 100 : 2.5;
      const repetitions = typeof row.reps === 'number' ? row.reps : 0;

      return {
        front,
        back,
        hint,
        tags: rawTags,
        interval,
        easeFactor,
        repetitions,
      };
    }).filter((c) => c.front && c.back);

    return {
      deckName,
      cards,
      totalCount: cards.length,
    };
  } finally {
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup error
    }
  }
}

module.exports = {
  generateAnkiPackage,
  parseAnkiPackage,
  createZipArchive,
  extractZipArchive,
};
