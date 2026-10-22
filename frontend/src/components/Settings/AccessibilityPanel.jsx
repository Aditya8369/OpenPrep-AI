import React, { useState } from 'react';
import {
  Eye,
  Type,
  Activity,
  Palette,
  Volume2,
  Check,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useAccessibility } from '../../context/AccessibilityContext';
import { ACCESSIBLE_PALETTES, getContrastRatio } from '../../utils/accessibleColorPalettes';
import VintagePaper from '../dashboard/VintagePaper';

export default function AccessibilityPanel() {
  const {
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
  } = useAccessibility();

  const [announcementSent, setAnnouncementSent] = useState(false);

  const handleTestAnnouncement = () => {
    announce('Screen reader live announcement verified. OpenPrep AI accessibility active.', 'polite');
    setAnnouncementSent(true);
    setTimeout(() => setAnnouncementSent(false), 2500);
  };

  const handleReset = () => {
    setHighContrast(false);
    setDyslexicFont(false);
    setReducedMotion(false);
    setColorblindPalette('normal');
    setFontSizeScale('default');
    announce('Accessibility settings reset to defaults.', 'polite');
  };

  // Contrast calculation between active high contrast colors
  const activeContrastRatio = highContrast ? getContrastRatio('#ffffff', '#000000') : getContrastRatio('#e1dcc9', '#1f150c');

  return (
    <VintagePaper className="border-t-4 border-t-amber-600 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 dark:bg-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-playfair text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
              Accessibility & Assistive Preferences
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-md">
                WCAG 2.1 AAA
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
              Customize contrast, typography, motion, and screen reader announcements for your study needs.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Defaults
        </button>
      </div>

      {/* Main Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. High-Contrast OLED Theme */}
        <div className="p-4 bg-neutral-100/70 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 rounded-xl flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-100">
                  High-Contrast OLED Mode
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                  Enforces strict ≥ 7:1 contrast ratio with pitch-black background and vivid borders.
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={highContrast}
              aria-label="Toggle High-Contrast OLED Mode"
              onClick={() => {
                const next = !highContrast;
                setHighContrast(next);
                announce(`High contrast mode ${next ? 'enabled' : 'disabled'}`);
              }}
              className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors cursor-pointer ${
                highContrast ? 'bg-amber-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                  highContrast ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
            <span>Contrast Ratio:</span>
            <strong className="text-amber-600 dark:text-amber-400 font-bold">{activeContrastRatio}:1</strong>
            <span>({activeContrastRatio >= 7 ? 'Level AAA Pass' : 'Standard'})</span>
          </div>
        </div>

        {/* 2. Dyslexia-Friendly Font */}
        <div className="p-4 bg-neutral-100/70 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 rounded-xl flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Type className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-100">
                  Dyslexia-Friendly Typography
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                  Switches to Atkinson Hyperlegible / OpenDyslexic with weighted bottoms to prevent letter reversals.
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={dyslexicFont}
              aria-label="Toggle Dyslexia-Friendly Typography"
              onClick={() => {
                const next = !dyslexicFont;
                setDyslexicFont(next);
                announce(`Dyslexia-friendly font ${next ? 'enabled' : 'disabled'}`);
              }}
              className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors cursor-pointer ${
                dyslexicFont ? 'bg-amber-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                  dyslexicFont ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
            Active: <strong className="text-neutral-800 dark:text-neutral-200">{dyslexicFont ? 'Atkinson Hyperlegible' : 'Inter (Default)'}</strong>
          </div>
        </div>

        {/* 3. Reduced Motion */}
        <div className="p-4 bg-neutral-100/70 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 rounded-xl flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-100">
                  Reduced Motion Mode
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                  Disables card 3D flip animations, confetti, and page motion for vestibular sensitivity.
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={reducedMotion}
              aria-label="Toggle Reduced Motion Mode"
              onClick={() => {
                const next = !reducedMotion;
                setReducedMotion(next);
                announce(`Reduced motion mode ${next ? 'enabled' : 'disabled'}`);
              }}
              className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors cursor-pointer ${
                reducedMotion ? 'bg-amber-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                  reducedMotion ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
            Animation state: <strong className="text-neutral-800 dark:text-neutral-200">{reducedMotion ? 'Instant Transitions' : 'Smooth Animations'}</strong>
          </div>
        </div>

        {/* 4. Font Size Scaling */}
        <div className="p-4 bg-neutral-100/70 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 rounded-xl flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Type className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-100">
                Text Size Scaling
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                Scale root text size for enhanced readability without breaking layout structure.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {[
              { id: 'default', label: '100% Standard' },
              { id: 'medium', label: '115% Medium' },
              { id: 'large', label: '130% Large' },
            ].map((scale) => (
              <button
                key={scale.id}
                type="button"
                onClick={() => {
                  setFontSizeScale(scale.id);
                  announce(`Font size scaled to ${scale.label}`);
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  fontSizeScale === scale.id
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-amber-500'
                }`}
              >
                {scale.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Colorblind Palette Selection */}
      <div className="p-4 bg-neutral-100/70 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 rounded-xl space-y-3">
        <div className="flex items-center gap-2.5">
          <Palette className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-100">
              Colorblind-Safe Chart & Data Palettes
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
              Configures Recharts visualization colors to remain distinct under specific color-vision deficiencies.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { id: 'normal', name: 'Standard Palette', desc: 'Trichromatic vision' },
            { id: 'deuteranopia', name: 'Deuteranopia', desc: 'Green-blind safe' },
            { id: 'protanopia', name: 'Protanopia', desc: 'Red-blind safe' },
            { id: 'tritanopia', name: 'Tritanopia', desc: 'Blue-blind safe' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setColorblindPalette(item.id);
                announce(`Color palette changed to ${item.name}`);
              }}
              className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition cursor-pointer ${
                colorblindPalette === item.id
                  ? 'border-amber-600 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-500'
                  : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-100">{item.name}</span>
                {colorblindPalette === item.id && <Check className="w-3.5 h-3.5 text-amber-600" />}
              </div>
              {/* Color swatches */}
              <div className="flex items-center gap-1">
                {ACCESSIBLE_PALETTES[item.id]?.slice(0, 5).map((color, idx) => (
                  <span
                    key={idx}
                    className="w-3.5 h-3.5 rounded-full border border-black/20"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-neutral-500">{item.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 6. Live Interactive Preview Card & Screen Reader Test */}
      <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
            Live Accessibility Typography Preview
          </span>
          <button
            type="button"
            onClick={handleTestAnnouncement}
            className="px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-md flex items-center gap-1.5 transition hover:bg-amber-100 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            {announcementSent ? 'Announcement Sent!' : 'Test Screen Reader Voice'}
          </button>
        </div>

        <div
          className={`p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 transition-all ${
            dyslexicFont ? 'font-dyslexic tracking-wide leading-loose' : 'font-sans leading-relaxed'
          }`}
        >
          <p className="text-sm text-neutral-800 dark:text-neutral-200 font-medium">
            "The fundamental theorem of calculus establishes the connection between differentiation and integration:
            if a continuous function is integrated, its derivative returns the original integrand."
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Focus indicator: Tab through buttons to view 3px focus ring
            </span>
          </div>
        </div>
      </div>
    </VintagePaper>
  );
}
