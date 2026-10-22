---
title: '[TESTING]: Playwright E2E Automated Visual Regression & Critical User Journey CI Test Suite'
labels: 'testing, e2e, frontend, ci/cd, medium-priority, NSoC, NSoC-L2'
assignees: ''
---

## Summary & Motivation
As new features and visual redesigns are contributed by open-source participants, regressions frequently occur—such as broken mobile navigation bars, unhandled authentication token expirations, CSS overflow glitches during quiz taking, or flashcard 3D flip crashes. Relying solely on manual testing leads to undetected UI regressions reaching production.

This issue introduces a comprehensive **Playwright End-to-End (E2E) Test Suite** with automated visual snapshot regression diffing running automatically on GitHub Actions CI.

---

## Technical Scope & Architecture

### 1. Playwright Setup & Configuration (`playwright.config.js`)
- Configures multi-browser testing: Chromium, Firefox, WebKit, and Mobile Chrome (Pixel 7 / iPhone 14 viewport).
- Sets up test web server (`npm run dev`) and test database fixtures with seeded mock user accounts.
- Configures parallel test runners and artifact capture (video on failure, trace viewer zip, screenshot diffs).

### 2. Critical Journey Test Specs (`tests/e2e/`)
- `auth.spec.js`:
  - Full registration, login, JWT token refresh, and logout flow.
  - Invalid password and locked account error handling.
- `quiz-flow.spec.js`:
  - Launch quiz -> Answer MCQs with keyboard shortcuts (1, 2, 3, 4) -> Submit -> Verify analytics increment.
- `flashcard-study.spec.js`:
  - Open deck -> Flip card -> Grade with Space / 1-4 -> Verify progress bar and streak retention.
- `visual-regression.spec.js`:
  - Compares pixel-perfect screenshot baselines of Dashboard, Quiz Arena, and Formula Sheet across Light and Dark themes.

### 3. GitHub Actions CI Workflow (`.github/workflows/e2e-tests.yml`)
- Triggers on pull requests targeting `main`.
- Runs Playwright tests inside Docker container.
- Uploads Playwright HTML report and visual failure diffs as GitHub workflow artifacts.

### Affected Areas
- [x] Testing
- [x] Frontend
- [x] CI/CD
- [x] DevOps

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 2 (Medium) (NSoC-L2)

---

## Acceptance Criteria
- [ ] Playwright test suite executes cleanly locally with `npx playwright test`.
- [ ] Critical paths (Auth, Quiz, Flashcards, Analytics) are covered with reliable, non-flaky assertions.
- [ ] Visual regression snapshot tests detect UI shifts, color breaks, and element overlaps.
- [ ] GitHub Actions workflow passes on clean branch and properly blocks PRs with regressions.
- [ ] Documentation added to `CONTRIBUTING.md` on how contributors can run and update Playwright snapshots.
