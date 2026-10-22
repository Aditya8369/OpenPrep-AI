import { describe, it, expect } from 'vitest';
import {
  normalizeFormula,
  tokenize,
  toRPN,
  compileExpression,
  numericalDerivative,
  formulaToKatex,
  findRoots,
  evaluateParametric,
} from './mathParser';

describe('mathParser', () => {
  describe('normalizeFormula', () => {
    it('strips y = and f(x) = prefixes', () => {
      expect(normalizeFormula('y = 2x + 1')).toBe('2 * x + 1');
      expect(normalizeFormula('f(x) = sin(x)')).toBe('sin(x)');
      expect(normalizeFormula('z = x^2 + y^2')).toBe('x**2 + y**2');
    });

    it('inserts implicit multiplication between numbers and variables/functions', () => {
      expect(normalizeFormula('2x')).toBe('2 * x');
      expect(normalizeFormula('3.5sin(x)')).toBe('3.5 * sin(x)');
      expect(normalizeFormula('4(x+2)')).toBe('4 * (x+2)');
      expect(normalizeFormula('(x+1)(x-1)')).toBe('(x+1) * (x-1)');
    });

    it('handles unicode math symbols correctly', () => {
      expect(normalizeFormula('2 × x + 5 ÷ y')).toBe('2 * x + 5 / y');
      expect(normalizeFormula('sin(2πx)')).toBe('sin(2 * pi * x)');
    });
  });

  describe('compileExpression evaluation', () => {
    it('evaluates basic polynomial arithmetic', () => {
      const fn = compileExpression('2x + 3');
      expect(fn({ x: 4 })).toBe(11);
      expect(fn({ x: -2 })).toBe(-1);
    });

    it('evaluates power and trigonometric functions', () => {
      const fn = compileExpression('sin(x) * x^2');
      expect(fn({ x: 0 })).toBe(0);
      const halfPi = Math.PI / 2;
      expect(fn({ x: halfPi })).toBeCloseTo(halfPi ** 2, 5);
    });

    it('handles damped oscillation formula from issue spec: sin(x) * exp(-0.1x)', () => {
      const fn = compileExpression('sin(x) * exp(-0.1x)');
      expect(fn({ x: 0 })).toBe(0);
      const val = Math.sin(1) * Math.exp(-0.1);
      expect(fn({ x: 1 })).toBeCloseTo(val, 5);
    });

    it('reactively evaluates custom parameter sliders (k, m, c, a, b)', () => {
      const fn = compileExpression('m * x + c');
      expect(fn({ x: 3, m: 2, c: 5 })).toBe(11);
      expect(fn({ x: 3, m: -1, c: 2 })).toBe(-1);

      const quadratic = compileExpression('a*x^2 + b*x + c');
      expect(quadratic({ x: 2, a: 1, b: -3, c: 2 })).toBe(0);
    });

    it('evaluates 3D surface formulas with x and y variables', () => {
      const saddle = compileExpression('x^2 - y^2');
      expect(saddle({ x: 3, y: 2 })).toBe(5);

      const ripple = compileExpression('sin(sqrt(x^2 + y^2))');
      expect(ripple({ x: 0, y: 0 })).toBe(0);
    });

    it('safely returns NaN on division by zero without crashing', () => {
      const fn = compileExpression('1 / x');
      expect(isNaN(fn({ x: 0 }))).toBe(true);
    });

    it('handles empty or invalid inputs gracefully', () => {
      const fn = compileExpression('');
      expect(isNaN(fn({ x: 1 }))).toBe(true);
    });
  });

  describe('numericalDerivative', () => {
    it('computes numerical derivative of x^2 at x = 3 to be ~6', () => {
      const fn = compileExpression('x^2');
      const df = numericalDerivative(fn, 3);
      expect(df).toBeCloseTo(6, 3);
    });

    it('computes derivative of sin(x) at x = 0 to be ~1 (cos(0))', () => {
      const fn = compileExpression('sin(x)');
      const df = numericalDerivative(fn, 0);
      expect(df).toBeCloseTo(1, 4);
    });
  });

  describe('findRoots', () => {
    it('locates root of x^2 - 4 in [-3, 3]', () => {
      const fn = compileExpression('x^2 - 4');
      const roots = findRoots(fn, -3, 3);
      expect(roots.length).toBeGreaterThanOrEqual(2);
      expect(roots.some((r) => Math.abs(r - -2) < 0.1)).toBe(true);
      expect(roots.some((r) => Math.abs(r - 2) < 0.1)).toBe(true);
    });
  });

  describe('formulaToKatex', () => {
    it('converts common formula notation to KaTeX syntax', () => {
      const katex1 = formulaToKatex('sin(x) * exp(-0.1*x)');
      expect(katex1).toContain('\\sin');
      expect(katex1).toContain('\\exp');
      expect(katex1).toContain('\\cdot');

      const katex2 = formulaToKatex('x^2 + pi');
      expect(katex2).toContain('x^{2}');
      expect(katex2).toContain('\\pi');
    });
  });

  describe('evaluateParametric', () => {
    it('computes unit circle parametric points x(t)=cos(t), y(t)=sin(t)', () => {
      const points = evaluateParametric('cos(t)', 'sin(t)', 0, Math.PI * 2, 20);
      expect(points.length).toBeGreaterThan(10);
      expect(points[0].x).toBeCloseTo(1, 4);
      expect(points[0].y).toBeCloseTo(0, 4);
      // Distance from origin should always be ~1
      for (const pt of points) {
        const dist = Math.sqrt(pt.x ** 2 + pt.y ** 2);
        expect(dist).toBeCloseTo(1, 4);
      }
    });
  });
});
