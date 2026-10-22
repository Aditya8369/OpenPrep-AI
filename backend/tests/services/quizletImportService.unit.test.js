const test = require('node:test');
const assert = require('node:assert/strict');
const {
  detectDelimiters,
  parseQuizletText,
  formatQuizletExport,
  extractClozeDeletions,
} = require('../../services/quizletImportService');

test('detectDelimiters identifies tab separator', () => {
  const text = 'Photosynthesis\tProcess of converting light into chemical energy\nMitochondria\tPowerhouse of cell';
  const { termSeparator } = detectDelimiters(text);
  assert.equal(termSeparator, '\t');
});

test('detectDelimiters identifies dash separator', () => {
  const text = 'Mitosis - Cell division resulting in two daughter cells\nMeiosis - Cell division resulting in gametes';
  const { termSeparator } = detectDelimiters(text);
  assert.equal(termSeparator, ' - ');
});

test('detectDelimiters identifies semicolon separator', () => {
  const text = 'Speed;Distance divided by time\nVelocity;Displacement divided by time';
  const { termSeparator } = detectDelimiters(text);
  assert.equal(termSeparator, ';');
});

test('parseQuizletText parses TSV with LaTeX and hints', () => {
  const text = 'Quadratic Formula\t$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$ (algebra)\nNewton Second Law\t$F = ma$';
  const cards = parseQuizletText(text);

  assert.equal(cards.length, 2);
  assert.equal(cards[0].front, 'Quadratic Formula');
  assert.equal(cards[0].back, '$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$');
  assert.equal(cards[0].hint, 'algebra');
  assert.equal(cards[1].front, 'Newton Second Law');
  assert.equal(cards[1].back, '$F = ma$');
});

test('parseQuizletText parses JSON format with starred items', () => {
  const jsonInput = JSON.stringify([
    { term: 'Epithelium', definition: 'Tissue lining body surfaces', starred: true },
    { term: 'Neuron', definition: 'Electrically excitable cell', hint: 'nervous system' },
  ]);

  const cards = parseQuizletText(jsonInput);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].front, 'Epithelium');
  assert.equal(cards[0].tags.includes('quizlet-starred'), true);
  assert.equal(cards[1].hint, 'nervous system');
});

test('extractClozeDeletions extracts indices and hints properly', () => {
  const sentence = 'The {{c1::hippocampus::brain area}} is crucial for {{c2::memory consolidation}}.';
  const clozes = extractClozeDeletions(sentence);

  assert.equal(clozes.length, 2);
  assert.equal(clozes[0].index, 1);
  assert.equal(clozes[0].answer, 'hippocampus');
  assert.equal(clozes[0].hint, 'brain area');
  assert.equal(clozes[1].index, 2);
  assert.equal(clozes[1].answer, 'memory consolidation');
  assert.equal(clozes[1].hint, null);
});

test('formatQuizletExport creates clean TSV with optional tags', () => {
  const cards = [
    { front: 'Cell Wall', back: 'Rigid outer layer in plant cells', tags: ['botany', 'biology'] },
    { front: 'Ribosome', back: 'Protein synthesis factory' },
  ];

  const exported = formatQuizletExport(cards, { includeTags: true });
  assert(exported.includes('Cell Wall\tRigid outer layer in plant cells #botany #biology'));
  assert(exported.includes('Ribosome\tProtein synthesis factory'));
});
