---
title: '[ACCESSIBILITY]: Comprehensive WCAG 2.1 AAA Compliance, Screen Reader Live Regions & High-Contrast Mode'
labels: 'accessibility, frontend, ui/ux, medium-priority, good first issue, NSoC, NSoC-L1'
assignees: ''
---

## Summary & Motivation
Education must be accessible to every student, including those with visual impairments, motor disabilities, or neurodivergent learning needs. Currently, dynamic quiz countdown timers, flashcard 3D flip animations, and chart visualizations lack proper screen reader announcements (`aria-live`), contain keyboard focus traps, and some color combinations fail WCAG contrast ratios.

This issue implements a comprehensive **WCAG 2.1 Level AAA Accessibility Overhaul** across the entire OpenPrep AI frontend.

---

## Technical Scope & Architecture

### 1. ARIA Live Regions & Dynamic Announcements (`frontend/src/components/common/AriaAnnouncer.jsx`)
- Implements a central accessible announcer for asynchronous events:
  - Quiz timer milestone updates ("5 minutes remaining", "1 minute remaining").
  - Flashcard flip state ("Flipped to definition: ...").
  - Quiz result calculation updates.
- Proper `role="status"`, `aria-live="polite"`, and `role="alert"` tagging.

### 2. Keyboard Navigation & Focus Management
- Eliminates keyboard traps across all modal dialogs, drawers, and dropdown menus using `@headlessui/react` focus traps.
- Implements visible, high-contrast `:focus-visible` rings on all interactive elements.
- Adds standard "Skip to main content" link for keyboard and screen reader navigation.

### 3. Display Preferences & Assistive Settings (`frontend/src/components/settings/AccessibilityPanel.jsx`)
- High-contrast OLED theme option with 7:1 minimum contrast ratio for text and icons.
- Dyslexia-friendly font toggle (`OpenDyslexic` or Atkinson Hyperlegible).
- Reduced Motion toggle respecting `prefers-reduced-motion` media query, disabling card flip animations and particle effects for photosensitive students.
- Colorblind-safe palettes for Recharts charts (Deuteranopia, Protanopia, Tritanopia color palettes).

### Affected Areas
- [x] Frontend
- [x] UI/UX
- [x] Accessibility

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 1 (Easy / Good First Issue) (NSoC-L1)

---

## Acceptance Criteria
- [ ] Automated accessibility audit using `axe-core` and Lighthouse scores 100/100 on all core pages.
- [ ] Full keyboard navigation is possible through entire quiz and flashcard review workflows without a mouse.
- [ ] Screen readers (NVDA, VoiceOver, JAWS) announce dynamic updates accurately.
- [ ] Color contrast ratios meet or exceed 7:1 for AAA compliance across all theme variations.
- [ ] Dyslexia font and reduced motion preferences persist across browser reloads.
