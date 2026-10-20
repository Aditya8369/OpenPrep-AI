/**
 * Card Deduplication & Vector Similarity Service
 * Computes semantic similarity between flashcards using vector embeddings
 * and identifies duplicate question clusters (> 0.88 similarity threshold).
 */

const SIMILARITY_THRESHOLD = 0.88;

/**
 * Computes cosine similarity between two numerical vectors
 * @param {Array<number>} vecA
 * @param {Array<number>} vecB
 * @returns {number} Value between -1.0 and 1.0 (or 0 if zero vector)
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;

  const len = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(-1, Math.min(1, similarity));
}

/**
 * Local lexical/shingle frequency embedding generator as fallback
 * when GEMINI_API_KEY is not configured or offline.
 * Produces a normalized 128-dimensional vector based on character and word n-grams.
 * @param {string} text
 * @returns {Array<number>}
 */
function generateLocalEmbedding(text) {
  const clean = String(text || '').toLowerCase().trim();
  const vector = new Array(128).fill(0);
  if (!clean) return vector;

  // Word tokenization
  const tokens = clean.split(/[^a-z0-9]+/i).filter(Boolean);
  for (const token of tokens) {
    let hash = 0;
    for (let j = 0; j < token.length; j++) {
      hash = (hash << 5) - hash + token.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 128;
    vector[idx] += 1;
  }

  // Character 3-grams for typo & morphology tolerance
  for (let i = 0; i < clean.length - 2; i++) {
    const gram = clean.slice(i, i + 3);
    let hash = 0;
    for (let j = 0; j < gram.length; j++) {
      hash = (hash << 5) - hash + gram.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 128;
    vector[idx] += 0.5;
  }

  // Normalize vector to unit length
  let norm = 0;
  for (let i = 0; i < 128; i++) {
    norm += vector[i] * vector[i];
  }
  if (norm > 0) {
    const sqrtNorm = Math.sqrt(norm);
    for (let i = 0; i < 128; i++) {
      vector[i] /= sqrtNorm;
    }
  }

  return vector;
}

/**
 * Generates vector embedding for text using Gemini text-embedding-004
 * with graceful fallback to local semantic vector.
 * @param {string} text
 * @returns {Promise<Array<number>>}
 */
async function generateEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return generateLocalEmbedding(text);
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    // Graceful fallback on API error, missing dependency, or rate limit
    return generateLocalEmbedding(text);
  }
}

/**
 * Scans a list of cards and finds pairwise duplicate clusters (> 0.88 similarity)
 * @param {Array<{id: string|number, front: string, back: string, hint?: string, tags?: Array<string>}>} cards
 * @param {number} threshold
 * @returns {Promise<Array<{canonicalCard: Object, duplicateCard: Object, similarity: number, reason: string}>>}
 */
async function findDuplicateClusters(cards = [], threshold = SIMILARITY_THRESHOLD) {
  if (!cards || cards.length < 2) return [];

  // Generate vectors for each card (front + back)
  const cardVectors = [];
  for (const card of cards) {
    const combinedText = `${card.front} ${card.back}`.trim();
    const vector = await generateEmbedding(combinedText);
    cardVectors.push({ card, vector });
  }

  const duplicates = [];
  const visited = new Set();

  for (let i = 0; i < cardVectors.length; i++) {
    for (let j = i + 1; j < cardVectors.length; j++) {
      const cardA = cardVectors[i].card;
      const cardB = cardVectors[j].card;

      const sim = cosineSimilarity(cardVectors[i].vector, cardVectors[j].vector);

      if (sim >= threshold) {
        duplicates.push({
          canonicalCard: cardA,
          duplicateCard: cardB,
          similarity: Math.round(sim * 1000) / 1000,
          reason: `High semantic similarity (${Math.round(sim * 100)}%) between definitions`,
        });
      }
    }
  }

  return duplicates;
}

/**
 * Merges duplicate Card B into canonical Card A, combining notes, tags, and hints.
 * @param {Object} canonical
 * @param {Object} duplicate
 * @returns {Object} Enriched card payload
 */
function mergeCardPair(canonical, duplicate) {
  const mergedTags = Array.from(
    new Set([
      ...(Array.isArray(canonical.tags) ? canonical.tags : []),
      ...(Array.isArray(duplicate.tags) ? duplicate.tags : []),
    ])
  );

  let mergedBack = canonical.back || '';
  if (duplicate.back && !canonical.back.toLowerCase().includes(duplicate.back.toLowerCase().trim())) {
    mergedBack += `\n\n[Supplementary Note]: ${duplicate.back}`;
  }

  const mergedHint = canonical.hint || duplicate.hint || null;

  return {
    ...canonical,
    back: mergedBack,
    hint: mergedHint,
    tags: mergedTags,
    interval: Math.max(canonical.interval || 1, duplicate.interval || 1),
    repetitions: Math.max(canonical.repetitions || 0, duplicate.repetitions || 0),
    efactor: Math.round((((canonical.efactor || 2.5) + (duplicate.efactor || 2.5)) / 2) * 100) / 100,
  };
}

module.exports = {
  SIMILARITY_THRESHOLD,
  cosineSimilarity,
  generateLocalEmbedding,
  generateEmbedding,
  findDuplicateClusters,
  mergeCardPair,
};
