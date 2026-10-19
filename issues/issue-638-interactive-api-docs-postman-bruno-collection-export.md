---
title: '[DOCS]: Comprehensive API Endpoint Documentation with Postman / Bruno Collection Export'
labels: 'documentation, backend, devops, good first issue, low-priority, NSoC, NSoC-L1'
assignees: ''
---

## Summary & Motivation
As new contributors join OpenPrep AI through NSoC, onboarding friction occurs when developers need to understand authentication headers, request body schemas, and API responses for endpoints across auth, flashcards, quizzes, study plans, and AI services.

This task involves creating comprehensive, runnable API documentation, including an exported Postman/Bruno collection and an updated developer guide in `docs/api-reference.md`.

---

## Technical Scope & Architecture

### Documentation & Spec Artifacts
1. **API Reference Guide (`docs/api-reference.md`)**:
   - Comprehensive markdown breakdown of all REST API routes:
     - Authentication: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`.
     - Flashcards: `GET /api/flashcards`, `POST /api/flashcards/generate`, `PUT /api/flashcards/:id/review`.
     - Quiz & Battling: `POST /api/quiz/create`, `POST /api/quiz/submit`.
     - Study Planner: `GET /api/study-plans`, `POST /api/study-plans/generate`.
   - Each endpoint includes Request Headers, URL Parameters, JSON Request Schema, and Sample 200/400/401/500 JSON Responses.
2. **Postman & Bruno Collections**:
   - `docs/openprep-api.postman_collection.json`: v2.1 export with pre-configured Bearer token environment variables.
   - `docs/bruno-collection/`: Git-friendly Bruno API collection files for local development.

### Affected Areas
- [x] Backend
- [x] DevOps

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 1 (Easy / Beginner-friendly) (NSoC-L1)

---

## Acceptance Criteria
- [ ] Complete endpoint documentation in `docs/api-reference.md` covering all existing routes.
- [ ] Verified Postman Collection file with working pre-request auth scripts.
- [ ] Verified Bruno collection directory importable into Bruno client.
- [ ] Environment variable template (`baseUrl`, `authToken`) documented clearly.

