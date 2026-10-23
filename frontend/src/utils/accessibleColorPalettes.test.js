import { describe, it, expect } from 'vitest';
import {
  ACCESSIBLE_PALETTES,
  getAccessiblePalette,
  getRelativeLuminance,
  getContrastRatio,
  isWcagAaaCompliant,
} from './accessibleColorPalettes';

describe('accessibleColorPalettes', () => {
  describe('getAccessiblePalette', () => {
    it('returns standard palette for default or normal', () => {
      const palette = getAccessiblePalette('normal');
      expect(palette).toEqual(ACCESSIBLE_PALETTES.normal);
      expect(palette.length).toBeGreaterThanOrEqual(5);
    });

    it('returns verified colorblind palettes for deuteranopia, protanopia, and tritanopia', () => {
      expect(getAccessiblePalette('deuteranopia')).toEqual(ACCESSIBLE_PALETTES.deuteranopia);
      expect(getAccessiblePalette('protanopia')).toEqual(ACCESSIBLE_PALETTES.protanopia);
      expect(getAccessiblePalette('tritanopia')).toEqual(ACCESSIBLE_PALETTES.tritanopia);
    });

    it('falls back safely to normal palette if invalid type is requested', () => {
      expect(getAccessiblePalette('unknown-deficiency')).toEqual(ACCESSIBLE_PALETTES.normal);
    });
  });

  describe('getRelativeLuminance', () => {
    it('calculates 0 for pure black #000000', () => {
      expect(getRelativeLuminance('#000000')).toBe(0);
    });

    it('calculates 1 for pure white #ffffff', () => {
      expect(getRelativeLuminance('#ffffff')).toBeCloseTo(1, 4);
    });
  });

  describe('getContrastRatio', () => {
    it('calculates 21:1 maximum contrast ratio between black and white', () => {
      const ratio = getContrastRatio('#ffffff', '#000000');
      expect(ratio).toBe(21);
    });

    it('calculates 1:1 contrast ratio between identical colors', () => {
      const ratio = getContrastRatio('#123456', '#123456');
      expect(ratio).toBe(1);
    });
  });

  describe('isWcagAaaCompliant', () => {
    it('validates black on white as Level AAA compliant (>= 7:1)', () => {
      expect(isWcagAaaCompliant('#000000', '#ffffff')).toBe(true);
      expect(isWcagAaaCompliant('#ffffff', '#000000')).toBe(true);
    });

    it('identifies low-contrast color combinations that fail AAA', () => {
      expect(isWcagAaaCompliant('#888888', '#ffffff')).toBe(false);
      expect(isWcagAaaCompliant('#777777', '#000000')).toBe(false);
    });
  });
});
