/**
 * Quizlet & Delimited Text Parser Service
 * Parses Quizlet exports (TSV, CSV, custom delimiters, JSON),
 * preserves UTF-8, LaTeX math markup ($...$, $$...$$), and cloze deletions.
 */

/**
 * Detect delimiter used between terms and definitions in Quizlet export text.
 * Common Quizlet formats:
 * - Term [TAB] Definition
 * - Term [COMMA] Definition
 * - Custom delimiter (e.g. " - ", " : ", ";")
 *
 * @param {string} text
 * @returns {{ termSeparator: string, cardSeparator: string }}
 */
function detectDelimiters(text) {
  const sample = text.slice(0, 2000);
  
  // Card separator is usually newline
  const cardSeparator = '\n';
  
  // Test common term separators in first few lines
  const lines = sample.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { termSeparator: '\t', cardSeparator };
  }

  const tabCount = lines.filter((l) => l.includes('\t')).length;
  const commaCount = lines.filter((l) => l.includes(',')).length;
  const semicolonCount = lines.filter((l) => l.includes(';')).length;
  const dashCount = lines.filter((l) => l.includes(' - ') || l.includes(' — ')).length;

  if (tabCount >= lines.length * 0.5) {
    return { termSeparator: '\t', cardSeparator };
  }
  if (dashCount >= lines.length * 0.5) {
    return { termSeparator: sample.includes(' - ') ? ' - ' : ' — ', cardSeparator };
  }
  if (semicolonCount >= lines.length * 0.5) {
    return { termSeparator: ';', cardSeparator };
  }
  if (commaCount >= lines.length * 0.5) {
    return { termSeparator: ',', cardSeparator };
  }

  return { termSeparator: '\t', cardSeparator };
}

/**
 * Extract cloze deletions from text: {{c1::answer::hint}} or {{c1::answer}}
 *
 * @param {string} text
 * @returns {Array<{ index: number, answer: string, hint: string|null }>}
 */
function extractClozeDeletions(text) {
  if (!text || typeof text !== 'string') return [];
  const regex = /\{\{c(\d+)::(.*?)(?:::([^}]+))?\}\}/g;
  const results = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({
      index: parseInt(match[1], 10),
      answer: match[2].trim(),
      hint: match[3] ? match[3].trim() : null,
    });
  }
  return results;
}

/**
 * Parses raw Quizlet exported text or delimited string.
 *
 * @param {string|Buffer} input - Text content or buffer
 * @param {Object} [options]
 * @param {string} [options.termSeparator] - Custom delimiter between term and definition
 * @param {string} [options.cardSeparator] - Custom delimiter between cards
 * @returns {Array<{ front: string, back: string, hint: string|null, tags: string[] }>}
 */
function parseQuizletText(input, options = {}) {
  if (!input) return [];
  const text = (Buffer.isBuffer(input) ? input.toString('utf8') : String(input))
    .replace(/^\uFEFF/, '') // Strip UTF-8 BOM if present
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // If input is JSON
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : parsed.cards || parsed.items || [];
      return items.map((item) => ({
        front: String(item.front || item.term || item.word || '').trim(),
        back: String(item.back || item.definition || item.meaning || '').trim(),
        hint: item.hint ? String(item.hint).trim() : null,
        tags: Array.isArray(item.tags)
          ? item.tags.map(String)
          : (item.starred ? ['quizlet-starred'] : []),
      })).filter((c) => c.front && c.back);
    } catch {
      // Fall through to text delimiter parsing if JSON parsing fails
    }
  }

  const { termSeparator: detectedTermSep, cardSeparator: detectedCardSep } = detectDelimiters(text);
  const termSep = options.termSeparator || detectedTermSep;
  const cardSep = options.cardSeparator || detectedCardSep;

  const rawCards = text.split(cardSep);
  const parsedCards = [];

  for (let i = 0; i < rawCards.length; i++) {
    const rawLine = rawCards[i].trim();
    if (!rawLine || rawLine.startsWith('#')) continue;

    let front = '';
    let back = '';
    let hint = null;
    let tags = [];

    const splitIdx = rawLine.indexOf(termSep);
    if (splitIdx !== -1) {
      front = rawLine.substring(0, splitIdx).trim();
      back = rawLine.substring(splitIdx + termSep.length).trim();
    } else {
      continue;
    }

    // Check if card contains Quizlet star indicator
    if (back.includes('[starred]') || front.includes('[starred]')) {
      tags.push('quizlet-starred');
      front = front.replace(/\[starred\]/gi, '').trim();
      back = back.replace(/\[starred\]/gi, '').trim();
    }

    // Extract optional explicit hint format (e.g. "(hint: ...)") in front or back
    const hintMatch = front.match(/\((?:hint:\s*)([^)]+)\)/i) || back.match(/\((?:hint:\s*|hint\s*=\s*)([^)]+)\)/i);
    if (hintMatch) {
      hint = hintMatch[1].trim();
      if (front.includes(hintMatch[0])) {
        front = front.replace(hintMatch[0], '').trim();
      } else {
        back = back.replace(hintMatch[0], '').trim();
      }
    } else {
      // Also support standalone trailing parenthetical in back as hint if not inside math
      const trailingParen = back.match(/\s+\(([^)$]+)\)$/);
      if (trailingParen && !trailingParen[1].includes('$')) {
        hint = trailingParen[1].trim();
        back = back.substring(0, trailingParen.index).trim();
      }
    }

    // Extract hashtags as tags
    const tagMatches = back.match(/#([\w-]+)/g);
    if (tagMatches) {
      tags.push(...tagMatches.map((t) => t.substring(1)));
      back = back.replace(/#([\w-]+)/g, '').trim();
    }

    if (front && back) {
      parsedCards.push({
        front,
        back,
        hint,
        tags: Array.from(new Set(tags)),
      });
    }
  }

  return parsedCards;
}

/**
 * Formats flashcards as Quizlet compatible text export (TSV).
 *
 * @param {Array<{ front: string, back: string, tags?: string[] }>} cards
 * @param {Object} [options]
 * @param {string} [options.termSeparator] - default '\t'
 * @param {string} [options.cardSeparator] - default '\n'
 * @param {boolean} [options.includeTags] - whether to append tags as hashtags
 * @returns {string}
 */
function formatQuizletExport(cards, options = {}) {
  const termSep = options.termSeparator || '\t';
  const cardSep = options.cardSeparator || '\n';
  const includeTags = options.includeTags !== false;

  return cards
    .map((c) => {
      let back = c.back || '';
      if (includeTags && Array.isArray(c.tags) && c.tags.length > 0) {
        const hashtags = c.tags.map((t) => `#${t}`).join(' ');
        back = `${back} ${hashtags}`;
      }
      return `${(c.front || '').replace(/\r?\n/g, ' ')}${termSep}${back.replace(/\r?\n/g, ' ')}`;
    })
    .join(cardSep);
}

module.exports = {
  detectDelimiters,
  extractClozeDeletions,
  parseQuizletText,
  formatQuizletExport,
};
