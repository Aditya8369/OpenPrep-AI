/**
 * Free Spaced Repetition Scheduler (FSRS v4) Engine
 * Implements the DSR (Difficulty, Stability, Retrievability) mathematical model.
 *
 * References:
 * - FSRS v4 specification & algorithm
 * - Standard weights: w0..w16
 * - Retention model: R(t, S) = (1 + FACTOR * (t / S))^DECAY
 * - Interval formula: I(r, S) = (S / FACTOR) * (r^(1/DECAY) - 1)
 */

// Universal FSRS v4 constants
const FACTOR = 19 / 81; // ~0.2345679 ensures R(S, S) = 0.90
const DECAY = -0.5;

// Default optimized FSRS v4 parameters (w0..w16)
const DEFAULT_WEIGHTS = [
  0.4, 0.6, 2.4, 5.8, // w0-w3: Initial stability for Again, Hard, Good, Easy
  4.93, 0.94, // w4-w5: Initial difficulty base & slope
  0.86, 0.01, // w6-w7: Difficulty update slope & mean reversion weight
  1.49, 0.14, 0.94, // w8-w10: Stability update on recall
  2.18, 0.05, 0.34, 1.26, // w11-w14: Stability update on forget (lapse)
  0.29, 2.61, // w15-w16: Hard penalty & Easy bonus
];

const RATING = {
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4,
};

const STATE = {
  NEW: 'new',
  LEARNING: 'learning',
  REVIEW: 'review',
  RELEARNING: 'relearning',
};

class FSRSScheduler {
  constructor(weights = DEFAULT_WEIGHTS, requestRetention = 0.90) {
    this.w = weights && weights.length === 17 ? weights : DEFAULT_WEIGHTS;
    this.requestRetention = requestRetention >= 0.7 && requestRetention <= 0.99 ? requestRetention : 0.90;
  }

  /**
   * Probability of recall after elapsed time t (in days) given stability S (in days)
   * R(t, S) = (1 + FACTOR * (t / S))^DECAY
   */
  calculateRetrievability(elapsedDays, stability) {
    if (!stability || stability <= 0) return 0;
    if (elapsedDays <= 0) return 1.0;
    return Math.pow(1 + FACTOR * (elapsedDays / stability), DECAY);
  }

  /**
   * Calculate next interval (in days) required to maintain target retention r
   * I(r, S) = (S / FACTOR) * (r^(1/DECAY) - 1)
   */
  calculateNextInterval(stability, requestRetention = this.requestRetention) {
    if (!stability || stability <= 0) return 1;
    const r = requestRetention || this.requestRetention;
    const interval = (stability / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
    return Math.max(1, Math.round(interval));
  }

  /**
   * Initial Stability S0(G) where G in {1, 2, 3, 4}
   */
  initialStability(rating) {
    const idx = Math.max(1, Math.min(4, Math.round(rating))) - 1;
    return Math.max(0.1, this.w[idx]);
  }

  /**
   * Initial Difficulty D0(G) = w4 - (G - 3) * w5 clamped to [1.0, 10.0]
   */
  initialDifficulty(rating) {
    const g = Math.max(1, Math.min(4, Math.round(rating)));
    const d = this.w[4] - (g - 3) * this.w[5];
    return Math.max(1.0, Math.min(10.0, d));
  }

  /**
   * Mean-reverting next difficulty update:
   * deltaD = -w6 * (G - 3)
   * D' = w7 * D0(3) + (1 - w7) * (D + deltaD)
   */
  nextDifficulty(difficulty, rating) {
    const g = Math.max(1, Math.min(4, Math.round(rating)));
    const deltaD = -this.w[6] * (g - 3);
    const dPrime = this.w[7] * this.w[4] + (1 - this.w[7]) * (difficulty + deltaD);
    return Math.max(1.0, Math.min(10.0, dPrime));
  }

  /**
   * Stability increase on successful recall (Hard, Good, Easy)
   */
  stabilityOnRecall(difficulty, stability, retrievability, rating) {
    const g = Math.max(2, Math.min(4, Math.round(rating)));
    let bonus = 1.0;
    if (g === RATING.HARD) bonus = this.w[15];
    if (g === RATING.EASY) bonus = this.w[16];

    const hardPenaltyOrBonus = bonus;
    const sRecall =
      stability *
      (1 +
        Math.exp(this.w[8]) *
          (11 - difficulty) *
          Math.pow(stability, -this.w[9]) *
          (Math.exp(this.w[10] * (1 - retrievability)) - 1) *
          hardPenaltyOrBonus);

    return Math.max(0.1, sRecall);
  }

  /**
   * Stability reduction on forgetting/lapse (Again)
   */
  stabilityOnForget(difficulty, stability, retrievability) {
    const sForget =
      this.w[11] *
      Math.pow(difficulty, -this.w[12]) *
      (Math.pow(stability + 1, this.w[13]) - 1) *
      Math.exp(this.w[14] * (1 - retrievability));

    return Math.max(0.1, Math.min(stability, sForget));
  }

  /**
   * Main transition step for review execution
   * @param {Object} card Current card attributes
   * @param {number} rating Rating: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
   * @param {number} [elapsedDays] Days since previous review
   * @param {number} [targetRetention] Target retention (e.g. 0.90)
   */
  step(card = {}, rating, elapsedDays = null, targetRetention = null) {
    const g = Math.max(1, Math.min(4, Math.round(rating)));
    const retention = targetRetention || this.requestRetention;

    const currentStability = typeof card.stability === 'number' && card.stability > 0 ? card.stability : null;
    const currentDifficulty = typeof card.difficulty === 'number' && card.difficulty >= 1 ? card.difficulty : null;
    const currentState = card.state || STATE.NEW;
    const reps = (card.reps || 0) + 1;
    let lapses = card.lapses || 0;

    let nextS;
    let nextD;
    let nextState;

    if (currentStability === null || currentDifficulty === null || currentState === STATE.NEW) {
      // First review of a card
      nextS = this.initialStability(g);
      nextD = this.initialDifficulty(g);
      nextState = g === RATING.AGAIN ? STATE.LEARNING : STATE.REVIEW;
      if (g === RATING.AGAIN) lapses += 1;
    } else {
      // Subsequent review
      const actualElapsed = typeof elapsedDays === 'number' && elapsedDays >= 0 ? elapsedDays : card.elapsedDays || 1;
      const R = this.calculateRetrievability(actualElapsed, currentStability);
      nextD = this.nextDifficulty(currentDifficulty, g);

      if (g === RATING.AGAIN) {
        nextS = this.stabilityOnForget(currentDifficulty, currentStability, R);
        nextState = STATE.RELEARNING;
        lapses += 1;
      } else {
        nextS = this.stabilityOnRecall(currentDifficulty, currentStability, R, g);
        nextState = STATE.REVIEW;
      }
    }

    const scheduledDays = this.calculateNextInterval(nextS, retention);

    return {
      stability: Number(nextS.toFixed(4)),
      difficulty: Number(nextD.toFixed(4)),
      scheduledDays,
      interval: scheduledDays,
      reps,
      lapses,
      state: nextState,
      retrievability: Number(this.calculateRetrievability(0, nextS).toFixed(4)),
    };
  }

  /**
   * Forecast upcoming review intervals for all 4 ratings for UI badge rendering
   */
  calculateUpcomingIntervals(card = {}, elapsedDays = 0, targetRetention = null) {
    const results = {};
    const retention = targetRetention || this.requestRetention;

    [RATING.AGAIN, RATING.HARD, RATING.GOOD, RATING.EASY].forEach((rating) => {
      const forecast = this.step(card, rating, elapsedDays, retention);
      results[rating] = {
        days: forecast.scheduledDays,
        formatted: this.formatInterval(forecast.scheduledDays, rating),
      };
    });

    return results;
  }

  /**
   * Human readable interval formatting (<10m, 1d, 3d, 14d, 1.2mo, 1.5y)
   */
  formatInterval(days, rating) {
    if (rating === RATING.AGAIN && days <= 1) {
      return '< 10m';
    }
    if (days < 1) {
      return `${Math.max(10, Math.round(days * 24 * 60))}m`;
    }
    if (days === 1) {
      return '1d';
    }
    if (days < 30) {
      return `${Math.round(days)}d`;
    }
    if (days < 365) {
      const months = (days / 30).toFixed(1).replace(/\.0$/, '');
      return `${months}mo`;
    }
    const years = (days / 365).toFixed(1).replace(/\.0$/, '');
    return `${years}y`;
  }

  /**
   * Convert legacy SuperMemo SM-2 card parameters into initial FSRS (S, D)
   */
  convertSM2ToFSRS(sm2Card = {}) {
    const efactor = typeof sm2Card.efactor === 'number' ? sm2Card.efactor : 2.5;
    const interval = typeof sm2Card.interval === 'number' ? sm2Card.interval : 1;
    const repetitions = typeof sm2Card.repetitions === 'number' ? sm2Card.repetitions : 0;

    // Invert E-factor [1.3 to 2.5+] to Difficulty [1.0 to 10.0]
    // efactor 2.5 -> difficulty 4.0, efactor 1.3 -> difficulty 9.5
    const normalizedEF = Math.max(1.3, Math.min(3.0, efactor));
    const difficulty = Math.max(1.0, Math.min(10.0, 11.0 - (normalizedEF - 1.3) * (9.0 / 1.7)));

    // Estimate stability in days from interval and repetitions
    const stability = Math.max(0.4, Number(interval) || 1.0);

    let state = STATE.NEW;
    if (repetitions > 1 && interval > 1) {
      state = STATE.REVIEW;
    } else if (repetitions === 1) {
      state = STATE.LEARNING;
    }

    return {
      stability: Number(stability.toFixed(2)),
      difficulty: Number(difficulty.toFixed(2)),
      reps: repetitions,
      lapses: 0,
      state,
      scheduledDays: Math.max(1, Math.round(interval)),
    };
  }
}

module.exports = {
  FSRSScheduler,
  DEFAULT_WEIGHTS,
  RATING,
  STATE,
  FACTOR,
  DECAY,
};
