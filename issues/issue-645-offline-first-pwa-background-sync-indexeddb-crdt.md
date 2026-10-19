---
title: '[FEATURE]: Offline-First PWA Background Sync with IndexedDB & Vector State Conflict Resolution'
labels: 'enhancement, frontend, backend, database, high-priority, NSoC, NSoC-L3'
assignees: ''
---

## Summary & Motivation
Students often study in environments with spotty or zero internet access (e.g., subway commutes, flights, rural locations, campus library basements). If the application becomes unusable without an active network, students lose precious study momentum.

This feature transforms OpenPrep AI into a true **Offline-First Progressive Web App (PWA)**, allowing students to review flashcards, solve practice quizzes, and take notes completely offline, with automatic Background Sync and conflict-free data synchronization once connectivity resumes.

---

## Technical Scope & Architecture

### Frontend Offline Architecture
1. **Service Worker & Workbox Caching (`frontend/public/service-worker.js` & `frontend/src/serviceWorkerRegistration.js`)**:
   - Cache-first strategy for static assets (Vite JS/CSS bundles, fonts, SVG icons).
   - Network-first with IndexedDB fallback for API calls.
2. **IndexedDB Local Storage Engine (`frontend/src/services/offlineStorageService.js`)**:
   - Uses `idb` wrapper to persist decks, flashcards, pending review logs, and quiz results locally.
   - Outbox mutation queue: Any offline action (e.g. card graded "Easy") is appended to an `outbox_mutations` IndexedDB store with a monotonic local timestamp.
3. **Background Sync & Conflict Resolution (`frontend/src/services/syncManager.js`)**:
   - Registers `sync` event with the browser's ServiceWorker `SyncManager`.
   - Upon connection restoration, flushes queued outbox mutations to backend in batch (`POST /api/sync/batch`).
   - Implements Last-Write-Wins (LWW) with server revision clocks to prevent overwriting updates made from other devices.

### Backend Synchronization Endpoint
1. **Batch Sync Controller (`backend/controllers/syncController.js`)**:
   - `POST /api/sync/batch`: Atomic transaction processing queued client mutations and returning updated entity states.

### Affected Areas
- [x] Frontend
- [x] Backend
- [x] Database

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 3 (Hard / Advanced) (NSoC-L3)

---

## Acceptance Criteria
- [ ] App loads and functions when completely disconnected from network.
- [ ] Flashcard reviews completed offline persist in IndexedDB outbox.
- [ ] Online reconnection triggers automatic background synchronization.
- [ ] Server merges batch mutations without data corruption or duplicate records.
- [ ] Unit tests for IndexedDB outbox queue and network state detection listeners.

