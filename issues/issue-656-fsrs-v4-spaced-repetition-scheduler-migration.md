---
title: '[FEATURE]: Spaced Repetition Engine Migration from SM-2 to FSRS v4 (Free Spaced Repetition Scheduler)'
labels: 'enhancement, algorithm, backend, database, high-priority, NSoC, NSoC-L3'
assignees: ''
---

## Summary & Motivation
The existing flashcard spaced repetition scheduler uses SuperMemo SM-2 (designed in 1987). SM-2 uses rigid heuristics (Easiness Factor, fixed intervals), which leads to excessive reviews for easy cards and fails to model human memory decay accurately.

The modern **Free Spaced Repetition Scheduler (FSRS v4)** algorithm uses the DSR (Difficulty, Stability, Retrievability) model, proven across millions of flashcard reviews to reduce required study reviews by ~20–30% while maintaining the target retention rate (e.g. 90%). This issue migrates OpenPrep AI's spaced repetition engine to FSRS v4.

---

## Technical Scope & Architecture

### 1. FSRS v4 Algorithm Implementation (`backend/services/fsrsScheduler.js`)
- Implements the DSR model functions:
  - **Stability ($S$)**: Time (in days) for retrievability to decrease from 100% to 90%.
  - **Difficulty ($D$)**: Inherent complexity of the card (scale 1.0 to 10.0).
  - **Retrievability ($R$)**: Probability of recall after elapsed time $t$:
    $$R(t, S) = \left(1 + \text{FACTOR} \cdot \frac{t}{S}\right)^{\text{DECAY}}$$
- Next Interval Calculation based on requested retention target (default 0.90):
  $$I(r, S) = \frac{S}{\text{FACTOR}} \cdot (r^{1/\text{DECAY}} - 1)$$
- Handles 4 review rating buttons: `Again` (1), `Hard` (2), `Good` (3), `Easy` (4).

### 2. Database Schema Migration (`backend/migrations/xxxx-migrate-to-fsrs.js`)
- Adds columns to `flashcard_reviews` / `flashcards`:
  - `stability` (float)
  - `difficulty` (float)
  - `elapsed_days` (integer)
  - `scheduled_days` (integer)
  - `reps` (integer)
  - `lapses` (integer)
  - `state` (New / Learning / Review / Relearning)
- Provides backward compatibility migration converting existing SM-2 `easinessFactor` and `interval` into estimated initial FSRS $(S, D)$ values.

### 3. Frontend Flashcard Review Integration (`frontend/src/components/flashcards/ReviewRatingBar.jsx`)
- Displays real-time estimated next review intervals on the review buttons (e.g., `Again: 10m`, `Hard: 2d`, `Good: 6d`, `Easy: 14d`).
- User settings toggle to customize target retention (80% to 95%).

### Affected Areas
- [x] Backend
- [x] Algorithm
- [x] Database
- [x] Frontend

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 3 (Hard / Advanced) (NSoC-L3)

---

## Acceptance Criteria
- [ ] FSRS v4 algorithm correctly computes Difficulty ($D$), Stability ($S$), and next review interval for all 4 response ratings.
- [ ] Database migration successfully converts legacy SM-2 cards without data loss.
- [ ] Review UI accurately displays calculated upcoming intervals on each rating button.
- [ ] Retrievability decay graph visualizes retention decay curves for each card.
- [ ] Comprehensive unit test suite comparing calculated intervals against benchmark FSRS v4 test vectors.
