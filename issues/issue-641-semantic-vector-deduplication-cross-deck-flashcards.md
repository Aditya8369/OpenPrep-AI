---
title: '[ENHANCEMENT]: Semantic Vector Deduplication & Cross-Deck Flashcard Recommender'
labels: 'enhancement, ai, flashcards, backend, medium-priority, NSoC, NSoC-L2'
assignees: ''
---

## Summary & Motivation
When generating flashcards automatically from lecture notes or textbooks across different study sessions, the AI model frequently generates redundant flashcards covering identical definitions phrased slightly differently. This bloats student review queues with duplicate work.

This enhancement implements **Semantic Vector Deduplication & Similarity Merging** using Gemini text embeddings and cosine similarity scoring.

---

## Technical Scope & Architecture

### Backend Architecture
1. **Deduplication Engine (`backend/services/cardDeduplicationService.js`)**:
   - Generates vector embeddings for card fronts and backs during batch card creation using Gemini Embedding API.
   - Computes pairwise cosine similarity between newly generated cards and existing cards in the user's decks.
   - Cards with cosine similarity > 0.88 are flagged as duplicates.
   - Automatically merges supplementary notes/examples from the duplicate into the canonical card or prompts the student with a comparison modal.
2. **API Endpoint (`backend/controllers/flashcardController.js`)**:
   - `POST /api/flashcards/deck/:id/deduplicate`: Scans deck for internal duplicates, returns similarity clusters with recommendations.
   - `POST /api/flashcards/deck/:id/merge`: Merges specified duplicate pairs into an enriched single card.

### Affected Areas
- [x] Backend
- [x] AI
- [x] Flashcards

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 2 (Medium / Intermediate) (NSoC-L2)

---

## Acceptance Criteria
- [ ] Embedding generation runs on newly generated or updated flashcards.
- [ ] Identifies semantically duplicate questions with different phrasing (>0.88 threshold).
- [ ] Provides API endpoint to preview and merge detected duplicate card clusters.
- [ ] Unit tests for cosine similarity calculation and edge cases (identical strings, unrelated topics).

