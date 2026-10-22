---
title: '[FEATURE]: AI Subjective Essay & Code Solution Rubric-Based Auto-Grader'
labels: 'enhancement, ai, frontend, backend, high-priority, NSoC, NSoC-L3'
assignees: ''
---

## Summary & Motivation
While multiple-choice questions test recall and basic problem-solving, real examinations (such as AP Exams, University Finals, UPSC Mains, and Technical Coding Assessments) require written subjective essays or working code solutions. Currently, OpenPrep AI only provides automated scoring for objective MCQs.

This feature implements an **AI Subjective Answer Evaluator** that grades long-form student answers and coding submissions against structured institutional scoring rubrics, providing line-by-line feedback, point deductions with rationale, and model exemplar answers.

---

## Technical Scope & Architecture

### 1. Rubric Evaluation Service (`backend/services/rubricEvaluatorService.js`)
- Accepts:
  - `questionPrompt` (e.g. "Explain the mechanism of enzyme catalysis and the factors affecting reaction velocity.")
  - `studentSubmission` (text, markdown, or code)
  - `scoringRubric` (array of criteria, e.g. `{ criterion: "Lock-and-Key vs Induced Fit Hypothesis", maxPoints: 3 }`, `{ criterion: "Temperature and pH effects", maxPoints: 2 }`)
- Calls Gemini 1.5 Pro with structured schema output:
  - Criteria breakdown with points awarded per sub-section.
  - Granular annotations: quotes the student's text and provides inline praise or constructive critiques.
  - Overall grade percentage and a "Model High-Scoring Response".

### 2. Code Runner & Syntax Checker (`backend/services/codeLintService.js`)
- For coding questions: Runs syntax verification and static analysis (AST parsing for Python, JS, C++, Java) to identify algorithmic time complexity ($O(N)$), space efficiency, and missed edge cases.

### 3. Submission & Feedback UI (`frontend/src/pages/SubjectiveEvaluationView.jsx`)
- Split-screen layout:
  - Left: Student's submitted text or Monaco Code Editor with highlighted annotations.
  - Right: Interactive Rubric scorecard showing point distribution and expandable feedback remarks.
- "Re-attempt with Feedback" button to iterate and improve essay draft.

### Affected Areas
- [x] Frontend
- [x] Backend
- [x] AI
- [x] Database

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 3 (Hard / Advanced) (NSoC-L3)

---

## Acceptance Criteria
- [ ] Students can submit long-form essays and code snippets for evaluation.
- [ ] AI grades responses strictly against the defined rubric with clear mathematical point allocation.
- [ ] Line-level annotations highlight specific phrases in the student's submission.
- [ ] Evaluator handles edge cases (blank submissions, off-topic or gibberish answers) gracefully without crashing.
- [ ] Unit and mock tests for rubric JSON schema validation and scoring calculations.
