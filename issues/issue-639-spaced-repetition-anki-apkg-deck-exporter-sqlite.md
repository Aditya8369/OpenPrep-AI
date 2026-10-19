---
title: '[FEATURE]: Spaced Repetition Anki (.apkg) Deck Importer & Exporter with SQLite Packager'
labels: 'enhancement, flashcards, backend, frontend, medium-priority, NSoC, NSoC-L2'
assignees: ''
---

## Summary & Motivation
Anki is the gold standard desktop and mobile spaced repetition system with millions of active medical and STEM students. Students generating flashcards with OpenPrep AI frequently request the ability to export their generated cards directly into native Anki `.apkg` packages so they can review on AnkiDroid or AnkiMobile on the go.

This feature implements native **Anki .apkg Export and Import** using SQLite schema packaging and ZIP compression.

---

## Technical Scope & Architecture

### Backend Architecture
1. **Anki Packaging Service (`backend/services/ankiService.js`)**:
   - Generates valid Anki 2.1 SQLite databases (`collection.anki2` / `collection.anki21`):
     - Configures `col`, `notes`, and `cards` tables with standard Anki cloze and basic note models.
     - Maps OpenPrep AI card front, back, and hints into Anki note fields.
     - Bundles into a compressed `.apkg` ZIP archive containing the SQLite database and `media` JSON map.
2. **Anki Controller (`backend/controllers/ankiController.js`)**:
   - `GET /api/flashcards/deck/:id/export/anki`: Streams the generated `.apkg` file with `Content-Disposition: attachment; filename="<deck-name>.apkg"`.
   - `POST /api/flashcards/import/anki`: Parses uploaded `.apkg` files, extracts card notes, and persists them into the OpenPrep AI database.

### Frontend UI
1. **Export Modal Option (`frontend/src/components/flashcards/ExportDeckModal.jsx`)**:
   - Adds an "Export to Anki (.apkg)" button with an option to include difficulty tags and audio links.

### Affected Areas
- [x] Backend
- [x] Frontend

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 2 (Medium / Intermediate) (NSoC-L2)

---

## Acceptance Criteria
- [ ] Users can export any flashcard deck as a valid `.apkg` file.
- [ ] Generated `.apkg` file imports cleanly into official Anki Desktop (v24.x) without errors.
- [ ] Importer parses Anki files and converts notes into OpenPrep flashcards.
- [ ] Unit tests for SQLite database generation and ZIP compression stream.

