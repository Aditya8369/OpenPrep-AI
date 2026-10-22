---
title: '[ENHANCEMENT]: Adaptive CAT (Computerized Adaptive Testing) Engine with IRT (Item Response Theory)'
labels: 'enhancement, algorithm, backend, ai, high-priority, NSoC, NSoC-L3'
assignees: ''
---

## Summary & Motivation
Static quizzes present the same predetermined sequence of questions regardless of whether a student is a beginner or advanced. High-performing students waste time answering questions that are too easy, while struggling students encounter excessively difficult questions that harm confidence.

This issue introduces a dynamic **Computerized Adaptive Testing (CAT)** engine based on the **2-Parameter Logistic Item Response Theory (2PL-IRT)** model. As the student answers questions, the algorithm continuously recalculates their latent ability parameter ($\theta$), dynamically serving questions calibrated to maximize information gain and pinpoint their true competence level in 50% fewer questions.

---

## Technical Scope & Architecture

### 1. IRT Mathematical Engine (`backend/services/irtEngine.js`)
- Implements the 2PL-IRT probability function:
  $$P_i(\theta) = \frac{1}{1 + e^{-a_i(\theta - b_i)}}$$
  where:
  - $\theta$: Student latent ability estimate (-3.0 to +3.0 scale).
  - $b_i$: Question difficulty parameter.
  - $a_i$: Question discrimination parameter.
- Maximum Likelihood Estimation (MLE) or Expected A Posteriori (EAP) Bayesian update after each response:
  - Selects next question maximizing Fisher Information $I_i(\theta) = a_i^2 P_i(\theta)(1 - P_i(\theta))$.
- Termination criteria: Stops test when Standard Error of Measurement ($SEM \le 0.30$) or max question limit reached.

### 2. Adaptive Quiz Controller (`backend/controllers/adaptiveQuizController.js`)
- `POST /api/quiz/adaptive/start`: Initializes session with prior ability estimate or neutral $\theta = 0.0$.
- `POST /api/quiz/adaptive/respond`: Accepts user choice, evaluates correctness, updates $\theta$ and $SEM$, and fetches the optimal next question from the question bank.
- `POST /api/quiz/adaptive/finish`: Finalizes score, percentiles, and subject mastery breakdown.

### 3. Frontend Adaptive Quiz UI (`frontend/src/pages/AdaptiveQuizSession.jsx`)
- Displays real-time confidence convergence indicator (ability meter) without revealing test stress.
- Visual summary graph showing the trajectory of questions taken, difficulties tackled, and final calibrated ability score.

### Affected Areas
- [x] Backend
- [x] Frontend
- [x] Algorithm
- [x] Database

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 3 (Hard / Advanced) (NSoC-L3)

---

## Acceptance Criteria
- [ ] 2PL-IRT mathematical engine accurately updates ability estimates ($\theta$) and Fisher Information after each response.
- [ ] Quizzes dynamically pick appropriate difficulty questions based on previous answers.
- [ ] Adaptive test successfully reaches convergence within configured stopping criteria.
- [ ] Result screen visualizes question trajectory and calculated percentile score.
- [ ] Comprehensive unit tests validating IRT formulas and edge cases (all correct / all incorrect responses).
