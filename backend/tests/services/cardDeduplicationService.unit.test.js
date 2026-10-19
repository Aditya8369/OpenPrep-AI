const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cosineSimilarity,
  generateLocalEmbedding,
  findDuplicateClusters,
  mergeCardPair,
  SIMILARITY_THRESHOLD,
} = require('../../services/cardDeduplicationService');

test('cosineSimilarity calculates exact geometric similarity', () => {
  // Identical vectors -> 1.0
  const vecA = [1, 2, 3];
  assert.equal(Math.round(cosineSimilarity(vecA, vecA) * 1000) / 1000, 1.0);

  // Orthogonal vectors -> 0.0
  const vecB = [1, 0];
  const vecC = [0, 1];
  assert.equal(cosineSimilarity(vecB, vecC), 0.0);

  // Opposing vectors -> -1.0
  const vecD = [1, 2];
  const vecE = [-1, -2];
  assert.equal(Math.round(cosineSimilarity(vecD, vecE) * 1000) / 1000, -1.0);

  // Zero vectors -> 0.0
  assert.equal(cosineSimilarity([0, 0], [1, 2]), 0.0);
  assert.equal(cosineSimilarity([], []), 0.0);
  assert.equal(cosineSimilarity(null, [1]), 0.0);
});

test('generateLocalEmbedding produces normalized 128-dim vectors', () => {
  const emb1 = generateLocalEmbedding('What is photosynthesis?');
  const emb2 = generateLocalEmbedding('Explain the process of photosynthesis.');
  const emb3 = generateLocalEmbedding('Calculus integral of polynomial functions.');

  assert.equal(emb1.length, 128);
  assert.equal(emb2.length, 128);

  // Similar topics have high similarity
  const simRelated = cosineSimilarity(emb1, emb2);
  const simUnrelated = cosineSimilarity(emb1, emb3);

  assert(simRelated > simUnrelated, 'Related topics must score higher than unrelated topics');
  assert(simUnrelated < 0.3, 'Unrelated topics should have low similarity');
});

test('findDuplicateClusters detects duplicate cards above threshold', async () => {
  const cards = [
    {
      id: 'card-1',
      front: 'What is the powerhouse of the cell?',
      back: 'The mitochondria is the powerhouse of the cell, generating cellular ATP energy.',
      tags: ['biology', 'cell'],
    },
    {
      id: 'card-2',
      front: 'What is the powerhouse of the cell?',
      back: 'The mitochondria is the powerhouse of the cell, generating cellular ATP energy.',
      tags: ['biology'],
    },
    {
      id: 'card-3',
      front: 'Define Newton First Law of Motion',
      back: 'An object remains at rest or in uniform motion unless acted upon by a net external force.',
      tags: ['physics'],
    },
  ];

  const duplicates = await findDuplicateClusters(cards, SIMILARITY_THRESHOLD);

  assert.equal(duplicates.length, 1, 'Should find exactly 1 duplicate pair');
  assert.equal(duplicates[0].canonicalCard.id, 'card-1');
  assert.equal(duplicates[0].duplicateCard.id, 'card-2');
  assert(duplicates[0].similarity >= SIMILARITY_THRESHOLD, 'Similarity must meet or exceed threshold');
});

test('mergeCardPair merges notes, hints, tags and preserves SM-2 scheduling', () => {
  const canonical = {
    id: 'c1',
    front: 'What is Mitochondria?',
    back: 'Organelle generating ATP.',
    hint: 'Cell powerhouse',
    tags: ['biology'],
    interval: 5,
    repetitions: 3,
    efactor: 2.5,
  };

  const duplicate = {
    id: 'c2',
    front: 'What is Mitochondria?',
    back: 'Contains its own circular DNA and ribosomes.',
    tags: ['cells', 'cytology'],
    interval: 2,
    repetitions: 1,
    efactor: 2.3,
  };

  const merged = mergeCardPair(canonical, duplicate);

  assert.equal(merged.id, 'c1');
  assert.equal(merged.front, 'What is Mitochondria?');
  assert(merged.back.includes('Organelle generating ATP.'));
  assert(merged.back.includes('[Supplementary Note]: Contains its own circular DNA'));
  assert.equal(merged.hint, 'Cell powerhouse');

  // Tag union
  assert(merged.tags.includes('biology'));
  assert(merged.tags.includes('cells'));
  assert(merged.tags.includes('cytology'));

  // SM-2 values
  assert.equal(merged.interval, 5);
  assert.equal(merged.repetitions, 3);
  assert.equal(merged.efactor, 2.4);
});
