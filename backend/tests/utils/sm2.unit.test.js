const { calculateSM2 } = require('../../utils/sm2');

describe('SM-2 Spaced Repetition Utility Tests', () => {
  describe('Standard SM-2 Behavior (Default modifiers)', () => {
    it('should set interval = 1 on first successful review (repetitions = 0, quality >= 3)', () => {
      const result = calculateSM2({
        interval: 1,
        repetitions: 0,
        efactor: 2.5,
        quality: 4,
      });

      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
      expect(result.efactor).toBeCloseTo(2.5, 2);
    });

    it('should set interval = 6 on second successful review (repetitions = 1, quality >= 3)', () => {
      const result = calculateSM2({
        interval: 1,
        repetitions: 1,
        efactor: 2.5,
        quality: 4,
      });

      expect(result.interval).toBe(6);
      expect(result.repetitions).toBe(2);
      expect(result.efactor).toBeCloseTo(2.5, 2);
    });

    it('should calculate interval * efactor on third successful review (repetitions = 2, quality >= 3)', () => {
      const result = calculateSM2({
        interval: 6,
        repetitions: 2,
        efactor: 2.5,
        quality: 4,
      });

      expect(result.interval).toBe(15); // 6 * 2.5 = 15
      expect(result.repetitions).toBe(3);
    });

    it('should reset repetitions = 0 and interval = 1 on failed review (quality < 3)', () => {
      const result = calculateSM2({
        interval: 15,
        repetitions: 3,
        efactor: 2.5,
        quality: 2,
      });

      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(0);
    });

    it('should adjust E-Factor according to quality score', () => {
      const result = calculateSM2({
        interval: 6,
        repetitions: 2,
        efactor: 2.5,
        quality: 5, // perfect response, efactor increases
      });

      expect(result.efactor).toBeGreaterThan(2.5);
    });

    it('should never let E-Factor drop below 1.3', () => {
      const result = calculateSM2({
        interval: 6,
        repetitions: 2,
        efactor: 1.3,
        quality: 0,
      });

      expect(result.efactor).toBe(1.3);
    });
  });

  describe('Custom Modifiers and Multipliers', () => {
    it('should apply custom step 1 and step 2 intervals', () => {
      // Custom steps: step 1 = 3 days, step 2 = 10 days
      const resultStep1 = calculateSM2({
        interval: 1,
        repetitions: 0,
        efactor: 2.5,
        quality: 4,
        step1Interval: 3,
        step2Interval: 10,
      });
      expect(resultStep1.interval).toBe(3);

      const resultStep2 = calculateSM2({
        interval: 3,
        repetitions: 1,
        efactor: 2.5,
        quality: 4,
        step1Interval: 3,
        step2Interval: 10,
      });
      expect(resultStep2.interval).toBe(10);
    });

    it('should apply custom interval modifier on third successful review', () => {
      // 6 days * 2.5 efactor * 1.5 modifier = 22.5 => 23 days
      const result = calculateSM2({
        interval: 6,
        repetitions: 2,
        efactor: 2.5,
        quality: 4,
        intervalModifier: 1.5,
      });

      expect(result.interval).toBe(23);
    });

    it('should apply custom easiness factor modifier to E-Factor change', () => {
      const originalChange = 0.1 - (5 - 4) * (0.08 + (5 - 4) * 0.02); // 0.0 for quality=4
      // Let's test with quality=5 (efactor change = 0.1) and modifier=2.0
      const result = calculateSM2({
        interval: 6,
        repetitions: 2,
        efactor: 2.5,
        quality: 5,
        easyFactorModifier: 2.0,
      });

      // expected change = 0.1 * 2.0 = 0.2
      // new E-Factor = 2.5 + 0.2 = 2.7
      expect(result.efactor).toBeCloseTo(2.7, 2);
    });

    it('should fallback to defaults when custom parameters are invalid', () => {
      const result = calculateSM2({
        interval: 6,
        repetitions: 2,
        efactor: 2.5,
        quality: 4,
        easyFactorModifier: -1.0, // invalid, should default to 1.0
        intervalModifier: 0,      // invalid, should default to 1.0
        step1Interval: 'three',   // invalid, should default to 1
        step2Interval: null,      // invalid, should default to 6
      });

      expect(result.interval).toBe(15); // 6 * 2.5 = 15
    });

    it('should cap the next interval at 365 days to prevent integer overflow and runaway review dates', () => {
      const result = calculateSM2({
        interval: 300,
        repetitions: 5,
        efactor: 2.5,
        quality: 5,
      });

      expect(result.interval).toBe(365);
    });
  });

  describe('Early Review Handling', () => {
    it('should scale interval proportionally based on elapsed days when reviewed early', () => {
      // 30 days interval, reviewed on day 2 (elapsedDays = 2) with efactor = 2.5
      // formula: Math.round(30 + 2 * (2.5 - 1)) = 30 + 3 = 33 days
      const result = calculateSM2({
        interval: 30,
        repetitions: 3,
        efactor: 2.5,
        quality: 5,
        elapsedDays: 2,
      });

      expect(result.interval).toBe(33);
      expect(result.repetitions).toBe(4);
    });

    it('should fall back to standard interval expansion when elapsedDays is not provided or overdue', () => {
      const result = calculateSM2({
        interval: 30,
        repetitions: 3,
        efactor: 2.5,
        quality: 5,
        elapsedDays: 35,
      });

      // 30 * 2.5 = 75 days
      expect(result.interval).toBe(75);
    });
  });
});
