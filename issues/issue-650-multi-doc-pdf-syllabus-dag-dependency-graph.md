---
title: '[FEATURE]: Multi-Document PDF Syllabus Extractor & Topic Prerequisite DAG Dependency Graph'
labels: 'enhancement, ai, frontend, backend, NSoC, NSoC-L3'
assignees: ''
---

## Summary & Motivation
Students starting exam prep often face monolithic 50–100 page syllabus PDF documents with fragmented chapter listings, making it difficult to understand which foundational topics must be mastered first before tackling advanced subjects (e.g., mastering *Trigonometry* and *Limits* before studying *Integral Calculus*).

This feature introduces an **AI Multi-Document Syllabus Ingestion Pipeline** that extracts subjects, chapters, and topics, discovers foundational prerequisite relationships, and visualizes an interactive **Directed Acyclic Graph (DAG)** of topics using React Flow.

---

## Technical Scope & Architecture

### 1. Document Extraction & Topic Hierarchy Parser (`backend/services/syllabusParserService.js`)
- Ingests single or multi-part syllabus PDF documents.
- Uses `pdf-parse` with structural regex heading detectors to identify levels (Subject -> Unit -> Chapter -> Subtopic).
- Calls Gemini Flash API to resolve implicit prerequisite chains:
  - Generates nodes: `{ id: "limits", label: "Limits & Continuity", estimatedHours: 6 }`
  - Generates directed edges: `{ source: "functions_relations", target: "limits", relationship: "PREREQUISITE" }`
- Validates cycle freedom (topological sort check) to ensure the generated graph is a valid DAG.

### 2. Dependency Graph REST API (`backend/routes/syllabusRoutes.js`)
- `POST /api/syllabus/upload-pdf`: Parses syllabus PDF into structured JSON graph.
- `GET /api/syllabus/:id/dag`: Returns graph nodes, edges, user mastery status, and topological study sequence.
- `PATCH /api/syllabus/node/:id/status`: Updates topic completion state and unlocks downstream nodes.

### 3. Interactive DAG Visualizer (`frontend/src/components/syllabus/SyllabusGraphViewer.jsx`)
- Built using `@xyflow/react` (React Flow) with custom styled nodes:
  - `Locked` (greyed out until prerequisites are checked off).
  - `In-Progress` (pulsing border indicating current study focus).
  - `Mastered` (green badge with mastery percentage score).
- Features interactive minimap, zoom-to-fit, filter by subject, and one-click "Generate Quiz for this Topic" action.

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
- [ ] Syllabus PDFs parse accurately into structured hierarchical topic nodes.
- [ ] AI identifies topic prerequisites and builds valid cycle-free DAG structures.
- [ ] React Flow canvas renders smoothly with zoom, pan, and responsive node layouts.
- [ ] Marking a prerequisite topic as complete updates dependent node lock/unlock states dynamically.
- [ ] Full unit tests for topological sorting, cycle detection, and PDF schema extraction.
