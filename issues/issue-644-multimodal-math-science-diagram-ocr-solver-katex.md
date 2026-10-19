---
title: '[FEATURE]: Multimodal Math & Science Diagram OCR Solver with Interactive KaTeX Derivations'
labels: 'enhancement, ai, frontend, backend, high-priority, NSoC, NSoC-L3'
assignees: ''
---

## Summary & Motivation
Students studying Physics, Mathematics, and Engineering encounter complex problems containing geometry figures, circuit diagrams, chemical structures, and multi-line differential equations. Typing these manually into a text prompt is nearly impossible.

This feature implements a **Multimodal Math & Science Diagram OCR Solver** powered by Gemini Vision, parsing uploaded photos or camera snaps of textbook problems and outputting structured step-by-step LaTeX derivations with interactive formula scratchpads.

---

## Technical Scope & Architecture

### Backend AI Pipeline
1. **Multimodal Analysis Service (`backend/services/diagramOcrService.js`)**:
   - Ingests image buffers (JPEG, PNG, WebP) with strict input validation and image compression.
   - Calls Google Gemini 1.5 Pro / Flash Vision model with tailored system instruction:
     - Transcribes problem statement into clean Markdown + KaTeX math syntax.
     - Identifies known variables, target unknown, and governing physical laws/theorems.
     - Generates step-by-step mathematical derivation with every intermediate algebraic transition explained.
     - Flags common pitfall traps or units conversion errors.
2. **API Endpoint (`backend/routes/aiRoutes.js`)**:
   - `POST /api/ai/solve-diagram` with `multipart/form-data` image payload and optional subject hint.

### Frontend Interface
1. **Camera Capture & Crop Utility (`frontend/src/components/ocr/ProblemImageCapture.jsx`)**:
   - Supports webcam capture, file drag-and-drop, and client-side bounding-box cropping.
2. **Derivation Step Inspector (`frontend/src/components/ocr/DerivationViewer.jsx`)**:
   - Renders step-by-step KaTeX equations with foldable intermediate steps and interactive "Why did this step happen?" AI follow-up tooltip.

### Affected Areas
- [x] Frontend
- [x] Backend
- [x] AI

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 3 (Hard / Advanced) (NSoC-L3)

---

## Acceptance Criteria
- [ ] Supports image upload (drag-drop, file picker, camera capture) with client-side crop.
- [ ] Gemini Vision accurately transcribes and breaks down equations into KaTeX notation.
- [ ] Step-by-step explanation renders with proper mathematical typography.
- [ ] Handles rate limits and non-math image rejections cleanly with clear error toasts.
- [ ] Comprehensive unit tests for file validation and OCR response parsing.

