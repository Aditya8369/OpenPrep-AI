/**
 * Calculates next interval, repetitions, and easiness factor (E-Factor) using the SM-2 algorithm.
 * Supports custom modifiers for easiness factor change, interval scale, and initial step intervals.
 *
 * @param {Object} params
 * @param {number} params.interval Current interval in days
 * @param {number} params.repetitions Current number of consecutive successful repetitions
 * @param {number} params.efactor Current E-Factor (easiness factor)
 * @param {number} params.quality Quality score of the recall (0-5)
 * @param {number} [params.easyFactorModifier=1.0] Custom multiplier for the E-Factor change
 * @param {number} [params.intervalModifier=1.0] Custom overall interval modifier
 * @param {number} [params.step1Interval=1] Custom interval for first step (repetitions = 0)
 * @param {number} [params.step2Interval=6] Custom interval for second step (repetitions = 1)
 * @returns {Object} { interval, repetitions, efactor }
 */
exports.calculateSM2 = ({
  interval,
  repetitions,
  efactor,
  quality,
  elapsedDays = null,
  easyFactorModifier = 1.0,
  intervalModifier = 1.0,
  step1Interval = 1,
  step2Interval = 6,
}) => {
  let nextInterval;
  let nextRepetitions;
  let nextEfactor;

  // Enforce defaults if modifiers are passed as null/undefined or invalid numbers
  const efMod = typeof easyFactorModifier === 'number' && easyFactorModifier > 0 ? easyFactorModifier : 1.0;
  const intMod = typeof intervalModifier === 'number' && intervalModifier > 0 ? intervalModifier : 1.0;
  const s1Int = Number.isInteger(step1Interval) && step1Interval > 0 ? step1Interval : 1;
  const s2Int = Number.isInteger(step2Interval) && step2Interval > 0 ? step2Interval : 6;

  if (quality >= 3) {
    if (repetitions === 0) {
      nextInterval = s1Int;
    } else if (repetitions === 1) {
      nextInterval = s2Int;
    } else {
      // Account for early reviews by scaling progression with actual elapsed time
      if (typeof elapsedDays === 'number' && elapsedDays >= 0 && elapsedDays < interval) {
        nextInterval = Math.max(1, Math.round((interval + elapsedDays * (efactor - 1)) * intMod));
      } else {
        nextInterval = Math.round(interval * efactor * intMod);
      }
    }
    nextRepetitions = repetitions + 1;
  } else {
    nextRepetitions = 0;
    nextInterval = s1Int;
  }

  // Cap interval at 365 days (1 year) to prevent integer overflow and runaway review dates
  const MAX_INTERVAL = 365;
  if (nextInterval > MAX_INTERVAL) {
    nextInterval = MAX_INTERVAL;
  }

  // Adjust E-Factor
  const efactorChange = (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)) * efMod;
  nextEfactor = efactor + efactorChange;
  if (nextEfactor < 1.3) nextEfactor = 1.3;

  return {
    interval: nextInterval,
    repetitions: nextRepetitions,
    efactor: nextEfactor,
  };
};
