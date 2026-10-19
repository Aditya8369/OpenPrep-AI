---
title: '[FEATURE]: Keyboard Shortcut Modal & Command Palette Navigation for Quick Exam Workflows'
labels: 'enhancement, frontend, ui/ux, good first issue, low-priority, NSoC, NSoC-L1'
assignees: ''
---

## Summary & Motivation
When reviewing large decks of flashcards, taking timed mock tests, or switching between study modules, students lose focus when forced to repeatedly reach for their mouse or touchpad. Power users and accessibility-focused learners require standard keyboard navigation.

This issue implements a **Keyboard Shortcut Modal & Command Palette** that enables hands-free study navigation, quick action triggering, and accessible keyboard shortcuts across all key views of OpenPrep AI.

---

## Technical Scope & Architecture

### Frontend Components
1. **Shortcut Cheat Sheet Modal (`frontend/src/components/common/KeyboardShortcutModal.jsx`)**:
   - Accessible dialog triggered via `?` or `Ctrl + /` / `Cmd + /`.
   - Categorized keyboard commands:
     - **Flashcards**: `Space` (flip card), `1`-`4` (rate difficulty: Again, Hard, Good, Easy), `Left` / `Right` (prev/next card).
     - **Quiz Arena**: `A`, `B`, `C`, `D` or `1`-`4` (select option), `Enter` (submit answer), `N` (next question).
     - **Global**: `Ctrl + K` (quick search / command palette), `Esc` (close modal / back).
2. **Global Shortcut Hook (`frontend/src/hooks/useKeyboardShortcuts.js`)**:
   - Reusable hook with input focus protection (disables single-key shortcuts when the user is typing in `<input>`, `<textarea>`, or contentEditable elements).

### Affected Areas
- [x] Frontend
- [x] UI/UX

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 1 (Easy / Beginner-friendly) (NSoC-L1)

---

## Acceptance Criteria
- [ ] Pressing `?` or `Ctrl+/` opens the keyboard shortcut modal with categorized shortcuts.
- [ ] Flashcard study screen supports `Space` to flip and `1`-`4` to grade.
- [ ] Shortcuts automatically disable when typing in text fields to prevent unintended actions.
- [ ] Fully accessible with ARIA attributes and keyboard trap handling.
- [ ] Unit tests for `useKeyboardShortcuts` verifying event listeners and input guards.

