import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export const AccessibilityContext = createContext({
  highContrast: false,
  dyslexicFont: false,
  reducedMotion: false,
  colorblindPalette: 'normal',
  fontSizeScale: 'default',
  setHighContrast: () => {},
  setDyslexicFont: () => {},
  setReducedMotion: () => {},
  setColorblindPalette: () => {},
  setFontSizeScale: () => {},
  announce: () => {},
  announcement: { message: '', priority: 'polite', timestamp: 0 },
});

const STORAGE_KEYS = {
  highContrast: 'openprep_high_contrast',
  dyslexicFont: 'openprep_dyslexic_font',
  reducedMotion: 'openprep_reduced_motion',
  colorblindPalette: 'openprep_colorblind_palette',
  fontSizeScale: 'openprep_font_size_scale',
};

const getInitialReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem(STORAGE_KEYS.reducedMotion);
  if (saved !== null) return saved === 'true';
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
};

export const AccessibilityProvider = ({ children }) => {
  const [highContrast, setHighContrastState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.highContrast) === 'true';
  });

  const [dyslexicFont, setDyslexicFontState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.dyslexicFont) === 'true';
  });

  const [reducedMotion, setReducedMotionState] = useState(getInitialReducedMotion);

  const [colorblindPalette, setColorblindPaletteState] = useState(() => {
    if (typeof window === 'undefined') return 'normal';
    return localStorage.getItem(STORAGE_KEYS.colorblindPalette) || 'normal';
  });

  const [fontSizeScale, setFontSizeScaleState] = useState(() => {
    if (typeof window === 'undefined') return 'default';
    return localStorage.getItem(STORAGE_KEYS.fontSizeScale) || 'default';
  });

  const [announcement, setAnnouncement] = useState({
    message: '',
    priority: 'polite',
    timestamp: 0,
  });

  // Screen reader announcer function
  const announce = useCallback((message, priority = 'polite') => {
    if (!message) return;
    setAnnouncement({
      message,
      priority,
      timestamp: Date.now(),
    });

    // Also dispatch DOM event for external or non-React listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('openprep:announce', {
          detail: { message, priority },
        })
      );
    }
  }, []);

  // Update setters with local storage persistence
  const setHighContrast = (val) => {
    setHighContrastState(val);
    localStorage.setItem(STORAGE_KEYS.highContrast, String(val));
  };

  const setDyslexicFont = (val) => {
    setDyslexicFontState(val);
    localStorage.setItem(STORAGE_KEYS.dyslexicFont, String(val));
  };

  const setReducedMotion = (val) => {
    setReducedMotionState(val);
    localStorage.setItem(STORAGE_KEYS.reducedMotion, String(val));
  };

  const setColorblindPalette = (val) => {
    setColorblindPaletteState(val);
    localStorage.setItem(STORAGE_KEYS.colorblindPalette, val);
  };

  const setFontSizeScale = (val) => {
    setFontSizeScaleState(val);
    localStorage.setItem(STORAGE_KEYS.fontSizeScale, val);
  };

  // Sync state to HTML document attributes and CSS classes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;

    root.setAttribute('data-high-contrast', String(highContrast));
    root.setAttribute('data-dyslexic-font', String(dyslexicFont));
    root.setAttribute('data-reduced-motion', String(reducedMotion));
    root.setAttribute('data-colorblind-palette', colorblindPalette);
    root.setAttribute('data-font-scale', fontSizeScale);

    if (highContrast) {
      root.classList.add('high-contrast-mode');
    } else {
      root.classList.remove('high-contrast-mode');
    }

    if (dyslexicFont) {
      root.classList.add('font-dyslexic');
    } else {
      root.classList.remove('font-dyslexic');
    }

    if (reducedMotion) {
      root.classList.add('reduced-motion-mode');
    } else {
      root.classList.remove('reduced-motion-mode');
    }
  }, [highContrast, dyslexicFont, reducedMotion, colorblindPalette, fontSizeScale]);

  return (
    <AccessibilityContext.Provider
      value={{
        highContrast,
        dyslexicFont,
        reducedMotion,
        colorblindPalette,
        fontSizeScale,
        setHighContrast,
        setDyslexicFont,
        setReducedMotion,
        setColorblindPalette,
        setFontSizeScale,
        announce,
        announcement,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => useContext(AccessibilityContext);
