import { describe, it, expect, beforeEach } from 'vitest';
const {
  FSRSScheduler,
  DEFAULT_WEIGHTS,
  RATING,
  STATE,
  FACTOR,
  DECAY,
} = require('../../services/fsrsScheduler');

describe('FSRSScheduler (FSRS v4)', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = new FSRSScheduler();
  });

  describe('Mathematical DSR Model Foundations', () => {
    it('proves R(S, S) = 0.90 for any stability S', () => {
      [1, 5, 20, 100].forEach((S) => {
        const R = scheduler.calculateRetrievability(S, S);
        expect(R).toBeCloseTo(0.90, 4);
      });
    });

    it('returns R = 1.0 when elapsedDays = 0', () => {
      expect(scheduler.calculateRetrievability(0, 10)).toBe(1.0);
    });

    it('monotonically decays retrievability as elapsed time increases', () => {
      const S = 10;
      const r1 = scheduler.calculateRetrievability(1, S);
      const r5 = scheduler.calculateRetrievability(5, S);
      const r10 = scheduler.calculateRetrievability(10, S);
      const r30 = scheduler.calculateRetrievability(30, S);

      expect(r1).toBeGreaterThan(r5);
      expect(r5).toBeGreaterThan(r10);
      expect(r10).toBeGreaterThan(r30);
      expect(r10).toBeCloseTo(0.9, 3);
    });

    it('calculates interval = S when target retention is 0.90', () => {
      [4, 10, 25, 60].forEach((S) => {
        const interval = scheduler.calculateNextInterval(S, 0.90);
        expect(interval).toBe(S);
      });
    });

    it('calculates shorter intervals for higher retention and longer for lower retention', () => {
      const S = 20;
      const interval80 = scheduler.calculateNextInterval(S, 0.80);
      const interval90 = scheduler.calculateNextInterval(S, 0.90);
      const interval95 = scheduler.calculateNextInterval(S, 0.95);

      expect(interval80).toBeGreaterThan(interval90);
      expect(interval90).toBeGreaterThan(interval95);
    });
  });

  describe('Initial Review (New Cards)', () => {
    it('assigns correct initial stability and difficulty based on rating', () => {
      const resAgain = scheduler.step({ state: STATE.NEW }, RATING.AGAIN);
      const resHard = scheduler.step({ state: STATE.NEW }, RATING.HARD);
      const resGood = scheduler.step({ state: STATE.NEW }, RATING.GOOD);
      const resEasy = scheduler.step({ state: STATE.NEW }, RATING.EASY);

      // Stability increases with rating: Again < Hard < Good < Easy
      expect(resAgain.stability).toBeLessThan(resHard.stability);
      expect(resHard.stability).toBeLessThan(resGood.stability);
      expect(resGood.stability).toBeLessThan(resEasy.stability);

      // Difficulty decreases with rating: Again > Hard > Good > Easy
      expect(resAgain.difficulty).toBeGreaterThan(resHard.difficulty);
      expect(resHard.difficulty).toBeGreaterThan(resGood.difficulty);
      expect(resGood.difficulty).toBeGreaterThan(resEasy.difficulty);

      // Ratings are within [1.0, 10.0]
      expect(resAgain.difficulty).toBeLessThanOrEqual(10.0);
      expect(resEasy.difficulty).toBeGreaterThanOrEqual(1.0);

      // State transitions
      expect(resAgain.state).toBe(STATE.LEARNING);
      expect(resAgain.lapses).toBe(1);
      expect(resGood.state).toBe(STATE.REVIEW);
      expect(resGood.lapses).toBe(0);
    });
  });

  describe('Subsequent Reviews (Recall and Lapses)', () => {
    it('increases stability significantly on Easy review', () => {
      const card = {
        stability: 5.0,
        difficulty: 4.5,
        state: STATE.REVIEW,
        reps: 2,
        lapses: 0,
      };

      const result = scheduler.step(card, RATING.EASY, 5);

      expect(result.stability).toBeGreaterThan(card.stability * 1.5);
      expect(result.difficulty).toBeLessThan(card.difficulty);
      expect(result.reps).toBe(3);
      expect(result.scheduledDays).toBeGreaterThan(5);
    });

    it('decreases stability and increments lapse count on Again review', () => {
      const card = {
        stability: 14.0,
        difficulty: 5.0,
        state: STATE.REVIEW,
        reps: 4,
        lapses: 0,
      };

      const result = scheduler.step(card, RATING.AGAIN, 14);

      expect(result.stability).toBeLessThan(card.stability);
      expect(result.difficulty).toBeGreaterThan(card.difficulty);
      expect(result.lapses).toBe(1);
      expect(result.state).toBe(STATE.RELEARNING);
      expect(result.scheduledDays).toBeLessThanOrEqual(card.stability);
    });
  });

  describe('calculateUpcomingIntervals', () => {
    it('returns formatted interval preview strings for all 4 rating choices', () => {
      const card = {
        stability: 6.0,
        difficulty: 4.0,
        state: STATE.REVIEW,
        reps: 3,
      };

      const intervals = scheduler.calculateUpcomingIntervals(card, 6, 0.90);

      expect(intervals[RATING.AGAIN]).toBeDefined();
      expect(intervals[RATING.HARD]).toBeDefined();
      expect(intervals[RATING.GOOD]).toBeDefined();
      expect(intervals[RATING.EASY]).toBeDefined();

      expect(intervals[RATING.AGAIN].days).toBeLessThanOrEqual(intervals[RATING.HARD].days);
      expect(intervals[RATING.HARD].days).toBeLessThan(intervals[RATING.GOOD].days);
      expect(intervals[RATING.GOOD].days).toBeLessThan(intervals[RATING.EASY].days);

      expect(typeof intervals[RATING.GOOD].formatted).toBe('string');
      expect(intervals[RATING.AGAIN].formatted).toMatch(/(< 10m|\d+d|\d+m)/);
    });
  });

  describe('Legacy SM-2 to FSRS v4 Migration (convertSM2ToFSRS)', () => {
    it('converts high efactor (2.5) to moderate difficulty and matches interval', () => {
      const sm2Card = {
        efactor: 2.5,
        interval: 10,
        repetitions: 3,
      };

      const fsrsData = scheduler.convertSM2ToFSRS(sm2Card);

      expect(fsrsData.stability).toBe(10);
      expect(fsrsData.difficulty).toBeLessThan(5.0);
      expect(fsrsData.reps).toBe(3);
      expect(fsrsData.state).toBe(STATE.REVIEW);
    });

    it('converts low efactor (1.3) to high difficulty', () => {
      const sm2Card = {
        efactor: 1.3,
        interval: 1,
        repetitions: 0,
      };

      const fsrsData = scheduler.convertSM2ToFSRS(sm2Card);

      expect(fsrsData.difficulty).toBeGreaterThanOrEqual(9.0);
      expect(fsrsData.stability).toBe(1.0);
      expect(fsrsData.state).toBe(STATE.NEW);
    });
  });
});
