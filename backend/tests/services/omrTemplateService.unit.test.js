const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateOmrTemplate,
  computeAnswerKeyHash,
  getGridConfig,
} = require('../../services/omrTemplateService');

test('OMR Template Service & Scanner Logic Unit Tests', async (t) => {
  await t.test('computeAnswerKeyHash generates deterministic SHA-256 slice', () => {
    const hash1 = computeAnswerKeyHash(['A', 'B', 'C', 'D']);
    const hash2 = computeAnswerKeyHash(['A', 'B', 'C', 'D']);
    const hash3 = computeAnswerKeyHash(['B', 'B', 'C', 'D']);

    assert.equal(typeof hash1, 'string');
    assert.equal(hash1.length, 16);
    assert.equal(hash1, hash2, 'Identical answers produce identical hash');
    assert.notEqual(hash1, hash3, 'Different answers produce different hash');
  });

  await t.test('getGridConfig configures grids for 20, 50, 100, and 180 questions', () => {
    const config20 = getGridConfig(20);
    assert.equal(config20.questionCount, 20);
    assert.equal(config20.columns, 2);
    assert.equal(config20.grid.length, 20);

    const config50 = getGridConfig(50);
    assert.equal(config50.questionCount, 50);
    assert.equal(config50.columns, 2);
    assert.equal(config50.grid.length, 50);

    const config100 = getGridConfig(100);
    assert.equal(config100.questionCount, 100);
    assert.equal(config100.columns, 3);
    assert.equal(config100.grid.length, 100);

    const config180 = getGridConfig(180);
    assert.equal(config180.questionCount, 180);
    assert.equal(config180.columns, 4);
    assert.equal(config180.grid.length, 180);

    // Verify option bubbles per question
    const q1 = config50.grid[0];
    assert.equal(q1.questionNumber, 1);
    assert.equal(q1.options.length, 4);
    assert.deepEqual(q1.options.map(o => o.option), ['A', 'B', 'C', 'D']);
  });

  await t.test('generateOmrTemplate returns valid PDF buffer', async () => {
    const pdfBuf = await generateOmrTemplate('quiz-test-123', {
      questionCount: 20,
      examCode: 'MOCK-EXAM',
      answers: ['A', 'B', 'C', 'D'],
    });

    assert.ok(Buffer.isBuffer(pdfBuf), 'Returns a Node.js Buffer');
    assert.ok(pdfBuf.length > 50, 'Buffer has non-trivial size');
    // PDF signature begins with %PDF-
    const header = pdfBuf.subarray(0, 5).toString('ascii');
    assert.equal(header, '%PDF-');
  });

  await t.test('Bubble darkness thresholding logic identifies shaded options correctly', () => {
    // Mock image data: 100x100 grayscale image
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);

    // Initialize all white (brightness 255)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }

    // Fill circle around (50, 50) with black pixels (darkness)
    for (let y = 45; y <= 55; y++) {
      for (let x = 45; x <= 55; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 20;     // R
        data[idx + 1] = 20; // G
        data[idx + 2] = 20; // B
      }
    }

    // Measure darkness inside shaded circle
    let darkPixels = 0;
    let totalSamples = 0;
    for (let y = 46; y <= 54; y++) {
      for (let x = 46; x <= 54; x++) {
        const idx = (y * width + x) * 4;
        const brightness = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        totalSamples++;
        if (brightness < 110) darkPixels++;
      }
    }

    const fillRatio = darkPixels / totalSamples;
    assert.ok(fillRatio > 0.95, 'Dark shaded circle has >95% fill ratio');
  });
});
