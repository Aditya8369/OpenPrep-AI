import { describe, it, expect } from 'vitest';
import { cleanLatexForPlotting, detectGraphableEquations } from './useAutoGraphDetection';

describe('useAutoGraphDetection', () => {
  describe('cleanLatexForPlotting', () => {
    it('converts fractions, powers, and math functions into evaluable expressions', () => {
      const latex = '\\frac{1}{2} x^{2} + \\sin(x)';
      const clean = cleanLatexForPlotting(latex);
      expect(clean).toContain('((1)/(2))');
      expect(clean).toContain('x^(2)');
      expect(clean).toContain('sin(x)');
    });

    it('strips LaTeX delimiters and handles square roots', () => {
      const latex = '$\\sqrt{x^2 + 1}$';
      const clean = cleanLatexForPlotting(latex);
      expect(clean).toBe('sqrt(x^2 + 1)');
    });
  });

  describe('detectGraphableEquations', () => {
    it('detects explicit 2D function y = ... in problem solution text', () => {
      const text = `
        To find the trajectory, we integrate the equations of motion:
        $y = -0.5 x^2 + 2x$
        The peak occurs at $x = 2$.
      `;
      const detected = detectGraphableEquations(text);
      expect(detected.length).toBeGreaterThan(0);
      expect(detected[0].dimension).toBe('2D');
      expect(detected[0].type).toBe('explicit2D');
    });

    it('detects 3D surface equation z = f(x, y)', () => {
      const text = `Consider the saddle surface: z = x^2 - y^2 over the unit disk.`;
      const detected = detectGraphableEquations(text);
      expect(detected.some((e) => e.dimension === '3D')).toBe(true);
    });

    it('detects circle conic section equation x^2 + y^2 = 25', () => {
      const text = `The equation of the circle centered at origin is $x^2 + y^2 = 25$.`;
      const detected = detectGraphableEquations(text);
      expect(detected.some((e) => e.type === 'conic' && e.radius === 5)).toBe(true);
    });

    it('detects parametric equations x(t) = cos(t), y(t) = sin(t)', () => {
      const text = `The curve is parameterized by x(t) = 3*cos(t), y(t) = 3*sin(t).`;
      const detected = detectGraphableEquations(text);
      expect(detected.some((e) => e.type === 'parametric')).toBe(true);
    });

    it('detects 3D vector definitions \\vec{v} = [1, 2, 3]', () => {
      const text = `The normal vector is given by \\vec{v} = [1, 2, 3].`;
      const detected = detectGraphableEquations(text);
      expect(detected.some((e) => e.type === 'vector3D')).toBe(true);
      expect(detected[0].vector).toEqual([1, 2, 3]);
    });
  });
});
