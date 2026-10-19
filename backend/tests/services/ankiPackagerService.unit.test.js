const test = require('node:test');
const assert = require('node:assert/strict');
const ankiPackagerService = require('../../services/ankiPackagerService');

test('generateAnkiPackage creates valid .apkg ZIP archive with SQLite database', async () => {
  const cards = [
    {
      front: 'What is Newton second law?',
      back: 'F = ma (Force equals mass times acceleration)',
      hint: 'Relates force and mass',
      tags: ['physics', 'mechanics'],
      interval: 4,
      easeFactor: 2.6,
      repetitions: 3,
    },
    {
      front: 'What is Mitochondria?',
      back: 'Powerhouse of the cell generating ATP',
      hint: 'Cellular respiration',
      tags: ['biology', 'cells'],
      interval: 1,
      easeFactor: 2.5,
      repetitions: 1,
    },
  ];

  const deckName = 'Medical & Physics Prep';
  const apkgBuffer = await ankiPackagerService.generateAnkiPackage(cards, deckName);

  assert(Buffer.isBuffer(apkgBuffer), 'Output must be a Buffer');
  assert(apkgBuffer.length > 100, 'Output buffer must not be empty');

  // Verify ZIP magic number: PK\x03\x04
  assert.equal(apkgBuffer.readUInt32LE(0), 0x04034b50, 'Must have valid ZIP header');

  // Verify extraction of collection.anki2 and media
  const extracted = ankiPackagerService.extractZipArchive(apkgBuffer);
  assert(extracted['collection.anki2'], 'Must contain collection.anki2 SQLite file');
  assert(extracted['media'], 'Must contain media JSON file');

  // Verify round-trip parsing
  const parsed = await ankiPackagerService.parseAnkiPackage(apkgBuffer);
  assert.equal(parsed.deckName, deckName);
  assert.equal(parsed.cards.length, 2);

  const card1 = parsed.cards.find((c) => c.front.includes('Newton'));
  assert(card1, 'Card 1 must be present');
  assert(card1.back.includes('F = ma'), 'Card 1 back text must match');
  assert(card1.hint.includes('Relates force'), 'Card 1 hint must match');
  assert(card1.tags.includes('physics'), 'Card 1 tags must include physics');

  const card2 = parsed.cards.find((c) => c.front.includes('Mitochondria'));
  assert(card2, 'Card 2 must be present');
  assert(card2.back.includes('Powerhouse'), 'Card 2 back text must match');
});
