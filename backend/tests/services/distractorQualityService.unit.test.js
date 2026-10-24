import { describe, it, expect, vi } from 'vitest';

const {
  scoreDistractorQuality,
  evaluateOptionOverlap,
  evaluatePlausibility,
  buildMisconceptionHints,
  QUALITY_THRESHOLD,
} = require('../../services/distractorQualityService');
const { generateQuestionWithValidation } = require('../../services/quizGenerationService');

const GOOD = {
  text: 'Which gas do plants absorb during photosynthesis?',
  options: ['Carbon dioxide', 'Oxygen gas', 'Nitrogen gas', 'Water vapour'],
  correctAnswer: 'Carbon dioxide',
  explanation: 'Plants take in carbon dioxide and release oxygen.',
  difficulty: 'easy',
  category: 'Biology',
};

const WEAK = {
  text: 'Which organelle produces most of the cell energy?',
  options: [
    'The mitochondria, which produce ATP through oxidative phosphorylation across the inner membrane',
    'Always the nucleus',
    'Never the ribosome',
    'None of the above',
  ],
  correctAnswer:
    'The mitochondria, which produce ATP through oxidative phosphorylation across the inner membrane',
  explanation: 'Mitochondria make ATP.',
  difficulty: 'easy',
  category: 'Biology',
};

describe('scoreDistractorQuality', () => {
  it('passes a balanced question', () => {
    const result = scoreDistractorQuality(GOOD);
    expect(result.score).toBeGreaterThanOrEqual(QUALITY_THRESHOLD);
    expect(result.passes).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('fails a question with a long correct answer and giveaway wording', () => {
    const result = scoreDistractorQuality(WEAK);
    expect(result.score).toBeLessThan(QUALITY_THRESHOLD);
    expect(result.passes).toBe(false);
    expect(result.issues.join(' ')).toMatch(/longer than distractors/);
    expect(result.issues.join(' ')).toMatch(/giveaway wording/);
  });

  it('keeps the score between 0 and 1 and reports the sub scores', () => {
    const { score, breakdown } = scoreDistractorQuality(WEAK);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
    expect(Object.keys(breakdown)).toEqual(['symmetry', 'leakage', 'distinctness', 'plausibility']);
  });

  it('scores a question with fewer than two options as 0', () => {
    expect(scoreDistractorQuality({ options: ['a'], correctAnswer: 'a' }).score).toBe(0);
    expect(scoreDistractorQuality({}).score).toBe(0);
  });

  it('penalises options that overlap in meaning', () => {
    const overlapping = {
      options: [
        'increases the pressure',
        'increases the pressure',
        'decreases volume',
        'no change',
      ],
      correctAnswer: 'decreases volume',
    };
    const distinct = {
      options: [
        'increases the pressure',
        'raises the temperature',
        'decreases volume',
        'no change',
      ],
      correctAnswer: 'decreases volume',
    };
    const result = scoreDistractorQuality(overlapping);
    expect(result.issues.join(' ')).toMatch(/overlap/);
    expect(result.score).toBeLessThan(scoreDistractorQuality(distinct).score);
  });

  it('accepts the correct answer as an index', () => {
    const byIndex = scoreDistractorQuality({ ...WEAK, correctAnswer: 0 });
    expect(byIndex.score).toBe(scoreDistractorQuality(WEAK).score);
  });

  it('flags a distractor of a different kind than the correct answer', () => {
    const result = scoreDistractorQuality({
      options: ['9.8 m/s^2', '98 m/s^2', '0.98 m/s^2', 'It depends on the mass of the object'],
      correctAnswer: '9.8 m/s^2',
    });
    expect(result.issues).toContain('Option 4 is a different kind of answer than the correct one.');
  });
});

describe('evaluatePlausibility', () => {
  it('rewards numeric distractors built from common calculation slips', () => {
    // sign flip, doubled, off-by-one
    const slips = evaluatePlausibility(['4', '-4', '8', '5'], 0);
    // numbers with no link to the answer
    const random = evaluatePlausibility(['4', '17', '29', '63'], 0);
    expect(slips.plausibilityScore).toBeGreaterThan(random.plausibilityScore);
    expect(slips.unrelatedNumberIndexes).toEqual([]);
    expect(random.unrelatedNumberIndexes).toEqual([1, 2, 3]);
  });

  it('does not flag short math expressions against each other', () => {
    const result = evaluatePlausibility(['2x', 'x', '2', 'x^2'], 0);
    expect(result.mismatchedIndexes).toEqual([]);
  });
});

describe('evaluateOptionOverlap', () => {
  it('finds identical and near identical options', () => {
    const { overlappingPairs } = evaluateOptionOverlap([
      'The force doubles',
      'the force doubles.',
      'The force halves',
      'Unchanged',
    ]);
    expect(overlappingPairs).toContainEqual([0, 1]);
  });

  it('finds an option nested inside another', () => {
    const { overlappingPairs } = evaluateOptionOverlap([
      'kinetic energy',
      'kinetic energy and momentum',
      'potential energy',
      'heat',
    ]);
    expect(overlappingPairs).toContainEqual([0, 1]);
  });

  it('does not treat a number inside a longer number as overlap', () => {
    expect(evaluateOptionOverlap(['3', '13', '30', '7']).overlappingPairs).toEqual([]);
  });
});

describe('buildMisconceptionHints', () => {
  it('lists the issues and the guidelines', () => {
    const hints = buildMisconceptionHints(['Options 1 and 2 overlap in meaning.']);
    expect(hints).toContain('Options 1 and 2 overlap in meaning.');
    expect(hints).toMatch(/forgotten minus sign/);
  });
});

describe('generateQuestionWithValidation quality retry', () => {
  const valid = async () => ({ isValid: true });

  it('returns a good question on the first try without regenerating', async () => {
    const generateQuestion = vi.fn().mockResolvedValue(JSON.stringify(GOOD));
    const result = await generateQuestionWithValidation('Biology', 'easy', 'ctx', [], 'q1', {
      generateQuestion,
      validateQuestion: valid,
    });
    expect(result).toEqual(GOOD);
    expect(generateQuestion).toHaveBeenCalledTimes(1);
  });

  it('regenerates once with misconception hints when the score is under 0.75', async () => {
    const generateQuestion = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(WEAK))
      .mockResolvedValueOnce(JSON.stringify(GOOD));
    const result = await generateQuestionWithValidation('Biology', 'easy', 'ctx', [], 'q1', {
      generateQuestion,
      validateQuestion: valid,
    });
    expect(result).toEqual(GOOD);
    expect(generateQuestion).toHaveBeenCalledTimes(2);
    expect(generateQuestion.mock.calls[0][3]).toBeNull();
    expect(generateQuestion.mock.calls[1][3]).toMatch(/forgotten minus sign/);
    expect(generateQuestion.mock.calls[1][3]).toMatch(/giveaway wording/);
  });

  it('only retries once for quality and keeps the better attempt', async () => {
    const generateQuestion = vi.fn().mockResolvedValue(JSON.stringify(WEAK));
    const result = await generateQuestionWithValidation('Biology', 'easy', 'ctx', [], 'q1', {
      generateQuestion,
      validateQuestion: valid,
    });
    expect(generateQuestion).toHaveBeenCalledTimes(2);
    expect(result).toEqual(WEAK);
  });

  it('still returns the weak question if the retries fail validation', async () => {
    const generateQuestion = vi.fn().mockResolvedValue(JSON.stringify(WEAK));
    const validateQuestion = vi
      .fn()
      .mockResolvedValueOnce({ isValid: true })
      .mockResolvedValue({ isValid: false });
    const result = await generateQuestionWithValidation('Biology', 'easy', 'ctx', [], 'q1', {
      generateQuestion,
      validateQuestion,
    });
    expect(result).toEqual(WEAK);
  });

  it('returns null when nothing ever passes validation', async () => {
    const generateQuestion = vi.fn().mockResolvedValue(JSON.stringify(GOOD));
    const result = await generateQuestionWithValidation('Biology', 'easy', 'ctx', [], 'q1', {
      generateQuestion,
      validateQuestion: async () => ({ isValid: false }),
    });
    expect(result).toBeNull();
    expect(generateQuestion).toHaveBeenCalledTimes(3);
  });
});
