import { describe, it, expect, vi, beforeEach } from 'vitest';
const {
  calculateProbability,
  calculateFisherInformation,
  estimateAbilityEAP,
  selectNextOptimalQuestion,
  checkTerminationCriteria,
  thetaToPercentile,
} = require('../../services/irtEngine');
const {
  startAdaptiveQuiz,
  submitAdaptiveResponse,
  finishAdaptiveQuiz,
  catSessions,
  DEFAULT_ITEM_BANK,
} = require('../../controllers/adaptiveQuizController');

describe('irtEngine - 2PL-IRT Mathematical Engine', () => {
  describe('calculateProbability', () => {
    it('returns 0.5 when student ability equals item difficulty (theta = b)', () => {
      const p = calculateProbability(1.0, 1.0, 1.5);
      expect(p).toBeCloseTo(0.5, 4);
    });

    it('returns > 0.5 when student ability exceeds difficulty (theta > b)', () => {
      const p = calculateProbability(2.0, 0.5, 1.2);
      expect(p).toBeGreaterThan(0.5);
      expect(p).toBeLessThan(1.0);
    });

    it('returns < 0.5 when student ability is below difficulty (theta < b)', () => {
      const p = calculateProbability(-1.5, 0.0, 1.0);
      expect(p).toBeLessThan(0.5);
      expect(p).toBeGreaterThan(0.0);
    });
  });

  describe('calculateFisherInformation', () => {
    it('reaches maximum information gain when theta = b', () => {
      const maxInfo = calculateFisherInformation(0.5, 0.5, 1.0);
      const offPeakInfo = calculateFisherInformation(2.0, 0.5, 1.0);
      expect(maxInfo).toBeCloseTo(0.25, 4);
      expect(maxInfo).toBeGreaterThan(offPeakInfo);
    });

    it('scales quadratically with item discrimination parameter a', () => {
      const infoA1 = calculateFisherInformation(1.0, 1.0, 1.0); // 1^2 * 0.25 = 0.25
      const infoA2 = calculateFisherInformation(1.0, 1.0, 2.0); // 2^2 * 0.25 = 1.00
      expect(infoA2).toBeCloseTo(infoA1 * 4, 3);
    });
  });

  describe('estimateAbilityEAP', () => {
    it('returns theta = 0.0 and SEM = 1.0 when no responses are recorded', () => {
      const estimate = estimateAbilityEAP([]);
      expect(estimate.theta).toBe(0.0);
      expect(estimate.sem).toBe(1.0);
    });

    it('increases ability estimate (theta > 0) after answering correctly', () => {
      const responses = [
        { difficulty: 0.0, discrimination: 1.5, correct: true },
        { difficulty: 0.5, discrimination: 1.5, correct: true },
        { difficulty: 1.0, discrimination: 1.5, correct: true },
      ];
      const estimate = estimateAbilityEAP(responses);
      expect(estimate.theta).toBeGreaterThan(0.5);
      expect(estimate.sem).toBeLessThan(1.0); // SEM decreases as evidence accumulates
    });

    it('decreases ability estimate (theta < 0) after answering incorrectly', () => {
      const responses = [
        { difficulty: 0.0, discrimination: 1.5, correct: false },
        { difficulty: -0.5, discrimination: 1.5, correct: false },
        { difficulty: -1.0, discrimination: 1.5, correct: false },
      ];
      const estimate = estimateAbilityEAP(responses);
      expect(estimate.theta).toBeLessThan(-0.5);
      expect(estimate.sem).toBeLessThan(1.0);
    });

    it('handles edge case: all correct responses remain bounded without diverging', () => {
      const responses = Array(10).fill({ difficulty: 1.0, discrimination: 1.8, correct: true });
      const estimate = estimateAbilityEAP(responses);
      expect(Number.isFinite(estimate.theta)).toBe(true);
      expect(estimate.theta).toBeLessThanOrEqual(4.0);
      expect(estimate.theta).toBeGreaterThan(1.0);
    });

    it('handles edge case: all incorrect responses remain bounded without diverging', () => {
      const responses = Array(10).fill({ difficulty: -1.0, discrimination: 1.8, correct: false });
      const estimate = estimateAbilityEAP(responses);
      expect(Number.isFinite(estimate.theta)).toBe(true);
      expect(estimate.theta).toBeGreaterThanOrEqual(-4.0);
      expect(estimate.theta).toBeLessThan(-1.0);
    });
  });

  describe('selectNextOptimalQuestion', () => {
    it('selects an item that maximizes Fisher Information near current theta and excludes answered items', () => {
      const pool = [
        { id: 'q_easy', difficulty: -2.0, discrimination: 1.0 },
        { id: 'q_target', difficulty: 0.8, discrimination: 2.0 },
        { id: 'q_far', difficulty: 2.5, discrimination: 1.0 },
      ];

      // At theta = 0.8, q_target should have the highest information gain
      const selected = selectNextOptimalQuestion(pool, ['q_easy'], 0.8);
      expect(selected.id).toBe('q_target');
    });

    it('returns null when all questions from pool have been answered', () => {
      const pool = [{ id: 'q1', difficulty: 0 }, { id: 'q2', difficulty: 1 }];
      const selected = selectNextOptimalQuestion(pool, ['q1', 'q2'], 0.0);
      expect(selected).toBeNull();
    });
  });

  describe('checkTerminationCriteria', () => {
    it('does not terminate before minQuestions threshold is satisfied', () => {
      const session = {
        responses: [1, 2, 3], // 3 questions answered
        sem: 0.20, // Low SEM, but less than minQuestions (5)
      };
      const result = checkTerminationCriteria(session, { minQuestions: 5, targetSEM: 0.30 });
      expect(result.isFinished).toBe(false);
    });

    it('terminates when SEM <= targetSEM and minQuestions threshold is met', () => {
      const session = {
        responses: [1, 2, 3, 4, 5],
        sem: 0.28,
      };
      const result = checkTerminationCriteria(session, { minQuestions: 5, targetSEM: 0.30 });
      expect(result.isFinished).toBe(true);
      expect(result.reason).toBe('CONVERGENCE_ACHIEVED');
    });

    it('terminates when maxQuestions limit is reached', () => {
      const session = {
        responses: Array(15).fill(1),
        sem: 0.35, // Still above target SEM, but reached cap
      };
      const result = checkTerminationCriteria(session, { maxQuestions: 15 });
      expect(result.isFinished).toBe(true);
      expect(result.reason).toBe('MAX_QUESTIONS_REACHED');
    });
  });

  describe('thetaToPercentile', () => {
    it('maps theta=0.0 to approximately 50th percentile', () => {
      expect(thetaToPercentile(0.0)).toBe(50);
    });

    it('maps high ability (theta=+2.0) to upper percentiles (>= 95)', () => {
      expect(thetaToPercentile(2.0)).toBeGreaterThanOrEqual(95);
    });

    it('maps low ability (theta=-2.0) to lower percentiles (<= 5)', () => {
      expect(thetaToPercentile(-2.0)).toBeLessThanOrEqual(5);
    });
  });

  describe('adaptiveQuizController API endpoints', () => {
    let req, res;

    beforeEach(() => {
      req = {
        body: {},
        user: { id: 'usr-cat-123' },
      };
      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
    });

    it('startAdaptiveQuiz creates a new CAT session with calibrated starting item', async () => {
      req.body = { subject: 'Mathematics' };

      await startAdaptiveQuiz(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        sessionId: expect.stringMatching(/^cat_/),
        theta: 0.0,
        sem: 1.0,
        question: expect.objectContaining({
          id: expect.any(String),
          questionText: expect.any(String),
          options: expect.any(Array),
        }),
      }));
    });

    it('submitAdaptiveResponse updates ability estimate and returns next item', async () => {
      // First start a session
      req.body = {};
      await startAdaptiveQuiz(req, res);
      const startJson = res.json.mock.calls[0][0];
      const sessionId = startJson.sessionId;
      const questionId = startJson.question.id;

      // Submit correct response
      req.body = {
        sessionId,
        questionId,
        selectedOption: 1, // Assume option index
      };
      res.status.mockClear();
      res.json.mockClear();

      await submitAdaptiveResponse(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        isCorrect: expect.any(Boolean),
        theta: expect.any(Number),
        sem: expect.any(Number),
        trajectory: expect.any(Array),
      }));
    });

    it('finishAdaptiveQuiz finalizes session and computes percentiles and topic breakdown', async () => {
      // Start session
      req.body = {};
      await startAdaptiveQuiz(req, res);
      const sessionId = res.json.mock.calls[0][0].sessionId;

      req.body = { sessionId };
      res.status.mockClear();
      res.json.mockClear();

      await finishAdaptiveQuiz(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        sessionId,
        percentile: expect.any(Number),
        finalTheta: expect.any(Number),
        finalSEM: expect.any(Number),
        masteryBreakdown: expect.any(Array),
      }));
    });
  });
});
