---
title: '[FEATURE]: Anki .apkg & Quizlet Bi-Directional Deck Import/Export with Cloze & Media Preservation'
labels: 'enhancement, backend, frontend, database, high-priority, NSoC, NSoC-L2'
assignees: ''
---

## Summary & Motivation
Many students have spent hundreds of hours curating flashcard decks in desktop Anki or Quizlet. Reluctance to switch to OpenPrep AI often stems from the inability to easily bring their existing study libraries with them or export their OpenPrep AI generated decks back into mobile Anki apps.

This feature implements a robust **Bi-Directional Importer & Exporter** for **Anki (`.apkg` SQLite / ZIP packages)** and **Quizlet (CSV/JSON/TSV)**, preserving cloze deletions (`{{c1::answer}}`), audio attachments, and mathematical LaTeX markup.

---

## Technical Scope & Architecture

### 1. Anki `.apkg` Parser & Generator (`backend/services/ankiPackageService.js`)
- Uses `sql.js` / `better-sqlite3` and `jszip` to read and construct Anki package files:
  - Decompresses `.apkg` archive containing the SQLite `collection.anki2` database and `media` json map.
  - Parses card templates: Basic, Cloze (`{{c1::...}}`), and Reverse cards.
  - Extracts embedded images/audio files and stages them to cloud or local uploads storage.
  - Reconstructs `.apkg` SQLite databases when users export OpenPrep decks for external Anki use.

### 2. Quizlet & Delimited Text Parser (`backend/services/quizletImportService.js`)
- Parses custom delimited text (term/definition separated by tabs, commas, or custom characters).
- Automatically converts Quizlet star ratings and tags into OpenPrep deck categories.

### 3. Deck Import/Export Endpoints (`backend/routes/deckRoutes.js`)
- `POST /api/decks/import/anki`: Multipart file upload parsing `.apkg` packages in memory.
- `POST /api/decks/import/quizlet`: Ingests Quizlet export payloads.
- `GET /api/decks/:id/export/anki`: Streams generated `.apkg` bundle directly to client download.

### 4. Frontend Drag-and-Drop Import Wizard (`frontend/src/components/flashcards/DeckImportModal.jsx`)
- Visual deck preview before committing import (shows sample cards, total count, detected cloze count).
- Progress bar for media asset uploads.

### Affected Areas
- [x] Backend
- [x] Frontend
- [x] Database

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 2 (Medium) (NSoC-L2)

---

## Acceptance Criteria
- [ ] Users can upload standard Anki `.apkg` files and import cards with images and LaTeX intact.
- [ ] Cloze deletions (`{{c1::text}}`) display and function correctly in OpenPrep review sessions.
- [ ] Exporting an OpenPrep deck to `.apkg` opens and syncs seamlessly in official Anki desktop/mobile clients.
- [ ] Quizlet copy-paste and CSV imports parse cleanly with character encoding validation (UTF-8).
- [ ] Unit tests for SQLite schema extraction, zip decompression, and cloze regex matching.
