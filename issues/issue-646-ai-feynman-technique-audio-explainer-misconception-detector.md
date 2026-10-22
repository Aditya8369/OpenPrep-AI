---
title: '[FEATURE]: AI Feynman Technique Explainer & Real-Time Misconception Detector'
labels: 'enhancement, ai, frontend, backend, high-priority, NSoC, NSoC-L3'
assignees: ''
---

## Summary & Motivation
The Feynman Technique is universally recognized as one of the most effective study strategies: if you cannot explain a concept in simple terms to a beginner, you don't truly understand it. Currently, students test themselves passively by reading or taking MCQs, which creates an illusion of competence.

This feature introduces an **AI Feynman Technique Explainer** where the student teaches a concept (via live voice audio or written text) to an AI "Student Persona". The AI actively probes for gaps, flags jargon used without conceptual understanding, detects factual misconceptions, and provides a comprehension score with analogies to fix knowledge deficits.

---

## Technical Scope & Architecture

### 1. AI Conversation Engine (`backend/services/feynmanService.js`)
- **Novice Persona Modeling**:
  - Leverages Google Gemini 1.5 Flash with custom prompt directives acting as an inquisitive 12-year-old student or non-technical beginner.
  - Asks clarifying questions ("Wait, why does pressure drop when velocity increases? What is actually happening to the molecules?").
- **Misconception Detection Pipeline**:
  - Compares student's audio transcription or written submission against the textbook ground truth stored in the syllabus topic embeddings.
  - Flags 3 specific failure modes:
    1. *Jargon Masking*: Using technical words (e.g. "mitochondria is the powerhouse of the cell") without explaining the underlying mechanism.
    2. *Conceptual Inversion*: Reversing cause and effect (e.g. confusing resistance with conductance).
    3. *Over-generalization*: Applying principles outside their validity boundaries.
- **Mastery Metric**: Computes a 0–100% "Feynman Simplicity Index" evaluating clarity, accurate analogies, and vocabulary simplicity.

### 2. Backend API Layer (`backend/routes/feynmanRoutes.js`)
- `POST /api/feynman/start-session`: Initializes a concept session with target topic, difficulty, and student level.
- `POST /api/feynman/turn`: Ingests student audio or text, streams back AI response, misconception tags, and probing questions.
- `GET /api/feynman/session/:id/report`: Summarizes strengths, identified misconceptions, and suggested review cards.

### 3. Frontend Interactive Teaching Arena (`frontend/src/pages/FeynmanArena.jsx`)
- **Audio Recorder & Waveform (`frontend/src/components/feynman/AudioExplainer.jsx`)**:
  - Integrates Web Speech API and MediaRecorder API with real-time audio visualization using HTML5 Canvas.
- **Concept Breakdown Radar & Real-Time Insight Badges**:
  - Visual indicators: `Jargon Detected`, `Analogy Missing`, `Solid Explanation`, `Logical Leap`.
- **Feynman Summary Card**:
  - Generates downloadable PDF/PNG summary of what was learned and converted flashcards for weak areas.

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
- [ ] Users can start a Feynman session for any topic from their syllabus or notes.
- [ ] Voice input records smoothly with live audio spectrum visualizer and instant speech-to-text fallback.
- [ ] AI responds in character with probing Socratic questions rather than providing the solution directly.
- [ ] Misconceptions and circular definitions are highlighted with actionable correction feedback.
- [ ] Generates an end-of-session mastery report with option to auto-create flashcards for missing prerequisites.
- [ ] Complete unit and integration tests for AI prompt parsing and WebSocket/REST session streaming.
