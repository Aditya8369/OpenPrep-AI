/**
 * Accessible Color Palettes for WCAG 2.1 AAA Compliance
 * Includes verified colorblind-safe color schemes (Wong & Okabe-Ito, ColorBrewer)
 * and WCAG relative luminance / contrast calculation algorithms.
 */

// Universal colorblind-safe palettes (Wong & Okabe-Ito, Nature Methods 2011)
export const ACCESSIBLE_PALETTES = {
  normal: [
    '#6366f1', // Indigo
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#8b5cf6', // Violet
  ],
  deuteranopia: [
    '#0072b2', // Blue
    '#e69f00', // Orange
    '#56b4e9', // Sky Blue
    '#f0e442', // Yellow
    '#cc79a7', // Reddish Purple
    '#d55e00', // Vermilion
  ],
  protanopia: [
    '#0072b2', // Strong Blue
    '#e69f00', // Bright Orange
    '#56b4e9', // Light Blue
    '#f0e442', // Warm Yellow
    '#009e73', // Bluish Green
    '#cc79a7', // Reddish Purple
  ],
  tritanopia: [
    '#d73027', // Strong Red
    '#fc8d59', // Peach
    '#fee090', // Light Yellow
    '#91bfdb', // Light Blue
    '#4575b4', // Medium Blue
    '#313695', // Dark Navy
  ],
  highContrast: [
    '#ffffff', // Crisp White
    '#ffff00', // Vivid Yellow
    '#00ffff', // Electric Cyan
    '#ff00ff', // Vivid Magenta
    '#00ff00', // Pure Green
    '#ffa500', // Bright Orange
  ],
};

/**
 * Returns colorblind-friendly palette array
 */
export function getAccessiblePalette(paletteType = 'normal') {
  return ACCESSIBLE_PALETTES[paletteType] || ACCESSIBLE_PALETTES.normal;
}

/**
 * Calculates WCAG relative luminance from hex color
 */
export function getRelativeLuminance(hex) {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Computes WCAG contrast ratio between two hex colors (e.g. 7.5:1)
 * Returns ratio as a floating point number.
 */
export function getContrastRatio(hex1, hex2) {
  try {
    const l1 = getRelativeLuminance(hex1);
    const l2 = getRelativeLuminance(hex2);
    const brighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return Number(((brighter + 0.05) / (darker + 0.05)).toFixed(2));
  } catch {
    return 1;
  }
}

/**
 * Validates whether contrast meets WCAG 2.1 Level AAA (7:1 for normal text, 4.5:1 for large text)
 */
export function isWcagAaaCompliant(textHex, bgHex, isLargeText = false) {
  const ratio = getContrastRatio(textHex, bgHex);
  const threshold = isLargeText ? 4.5 : 7.0;
  return ratio >= threshold;
}
