import { describe, it, expect, beforeEach, vi } from 'vitest';

const Flashcard = require('../../models/Flashcard');
const User = require('../../models/User');
const Progress = require('../../models/Progress');
const gamificationService = require('../../services/gamificationService');
const analyticsAggregationService = require('../../services/analyticsAggregationService');

delete require.cache[require.resolve('../../controllers/flashcardController')];
const flashcardController = require('../../controllers/flashcardController');

describe('FSRS Flashcard Review Controller', () => {
  let req, res, next;

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(gamificationService, 'awardXP').mockResolvedValue({ totalXP: 100 });
    vi.spyOn(gamificationService, 'updateStreak').mockResolvedValue(true);
    vi.spyOn(gamificationService, 'checkAndUnlockBadges').mockResolvedValue([]);
    vi.spyOn(gamificationService, 'awardCoins').mockResolvedValue(true);
    vi.spyOn(analyticsAggregationService, 'recordFlashcardReviewEvent').mockResolvedValue(true);
    vi.spyOn(User, 'findByPk').mockResolvedValue({ id: 'usr-123' });
    vi.spyOn(Progress, 'findOrCreate').mockResolvedValue([{ flashcardsMastered: 1, save: vi.fn() }]);

    req = {
      params: { id: 'card-101' },
      query: {},
      user: {
        id: 'usr-123',
        fsrsTargetRetention: 0.90,
        sm2EasyFactorModifier: 1.0,
        sm2IntervalModifier: 1.0,
      },
      headers: {},
      body: {},
    };

    res = {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      },
    };

    next = vi.fn();
  });

  describe('reviewFlashcard with FSRS ratings (1-4)', () => {
    it('processes Good rating (3) and updates stability, reps, and nextReviewDate', async () => {
      const mockCard = {
        id: 'card-101',
        user: 'usr-123',
        subject: 'sub-1',
        topic: 'top-1',
        stability: 4.0,
        fsrsDifficulty: 5.0,
        state: 'review',
        reps: 2,
        lapses: 0,
        interval: 4,
        repetitions: 2,
        efactor: 2.5,
        updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Flashcard, 'findOne').mockResolvedValue(mockCard);

      req.body = { rating: 3 }; // Good

      await flashcardController.reviewFlashcard(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(mockCard.reps).toBe(3);
      expect(mockCard.stability).toBeGreaterThan(4.0);
      expect(mockCard.scheduledDays).toBeGreaterThanOrEqual(4);
      expect(mockCard.save).toHaveBeenCalled();
    });

    it('processes Again rating (1), records lapse, and transitions to relearning', async () => {
      const mockCard = {
        id: 'card-101',
        user: 'usr-123',
        subject: 'sub-1',
        topic: 'top-1',
        stability: 10.0,
        fsrsDifficulty: 4.5,
        state: 'review',
        reps: 4,
        lapses: 0,
        interval: 10,
        repetitions: 4,
        efactor: 2.5,
        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Flashcard, 'findOne').mockResolvedValue(mockCard);

      req.body = { rating: 1 }; // Again

      await flashcardController.reviewFlashcard(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(mockCard.lapses).toBe(1);
      expect(mockCard.state).toBe('relearning');
      expect(mockCard.stability).toBeLessThan(10.0);
      expect(mockCard.save).toHaveBeenCalled();
    });

    it('maintains backwards compatibility when legacy quality (0-5) is sent', async () => {
      const mockCard = {
        id: 'card-101',
        user: 'usr-123',
        subject: 'sub-1',
        topic: 'top-1',
        stability: null,
        fsrsDifficulty: null,
        state: 'new',
        reps: 0,
        interval: 1,
        repetitions: 0,
        efactor: 2.5,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Flashcard, 'findOne').mockResolvedValue(mockCard);

      req.body = { quality: 5 }; // Easy in SM-2

      await flashcardController.reviewFlashcard(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(mockCard.stability).toBeDefined();
      expect(mockCard.fsrsDifficulty).toBeDefined();
      expect(mockCard.scheduledDays).toBeGreaterThanOrEqual(1);
      expect(mockCard.save).toHaveBeenCalled();
    });
  });

  describe('getUpcomingIntervals', () => {
    it('returns forecasted intervals for all 4 ratings and retrievability', async () => {
      const mockCard = {
        id: 'card-101',
        user: 'usr-123',
        stability: 6.0,
        fsrsDifficulty: 4.2,
        state: 'review',
        reps: 3,
        lapses: 0,
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      };

      vi.spyOn(Flashcard, 'findOne').mockResolvedValue(mockCard);

      await flashcardController.getUpcomingIntervals(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.jsonData.success).toBe(true);
      expect(res.jsonData.intervals).toBeDefined();
      expect(res.jsonData.intervals[1]).toBeDefined(); // Again
      expect(res.jsonData.intervals[2]).toBeDefined(); // Hard
      expect(res.jsonData.intervals[3]).toBeDefined(); // Good
      expect(res.jsonData.intervals[4]).toBeDefined(); // Easy
      expect(res.jsonData.retrievability).toBeGreaterThan(0.8);
      expect(res.jsonData.targetRetention).toBe(0.90);
    });

    it('returns 404 when flashcard does not exist', async () => {
      vi.spyOn(Flashcard, 'findOne').mockResolvedValue(null);

      await flashcardController.getUpcomingIntervals(req, res, next);

      expect(res.statusCode).toBe(404);
      expect(res.jsonData.success).toBe(false);
    });
  });
});
