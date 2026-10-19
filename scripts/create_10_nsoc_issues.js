const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const issuesDir = path.join(__dirname, '..', 'issues');
if (!fs.existsSync(issuesDir)) {
  fs.mkdirSync(issuesDir, { recursive: true });
}

const nsocIssues = [
  {
    number: 636,
    slug: 'keyboard-shortcut-modal-command-palette-navigation',
    title: '[FEATURE]: Keyboard Shortcut Modal & Command Palette Navigation for Quick Exam Workflows',
    labels: ['enhancement', 'frontend', 'ui/ux', 'good first issue', 'low-priority', 'NSoC', 'NSoC-L1'],
    body: `## Summary & Motivation
When reviewing large decks of flashcards, taking timed mock tests, or switching between study modules, students lose focus when forced to repeatedly reach for their mouse or touchpad. Power users and accessibility-focused learners require standard keyboard navigation.

This issue implements a **Keyboard Shortcut Modal & Command Palette** that enables hands-free study navigation, quick action triggering, and accessible keyboard shortcuts across all key views of OpenPrep AI.

---

## Technical Scope & Architecture

### Frontend Components
1. **Shortcut Cheat Sheet Modal (\`frontend/src/components/common/KeyboardShortcutModal.jsx\`)**:
   - Accessible dialog triggered via \`?\` or \`Ctrl + /\` / \`Cmd + /\`.
   - Categorized keyboard commands:
     - **Flashcards**: \`Space\` (flip card), \`1\`-\`4\` (rate difficulty: Again, Hard, Good, Easy), \`Left\` / \`Right\` (prev/next card).
     - **Quiz Arena**: \`A\`, \`B\`, \`C\`, \`D\` or \`1\`-\`4\` (select option), \`Enter\` (submit answer), \`N\` (next question).
     - **Global**: \`Ctrl + K\` (quick search / command palette), \`Esc\` (close modal / back).
2. **Global Shortcut Hook (\`frontend/src/hooks/useKeyboardShortcuts.js\`)**:
   - Reusable hook with input focus protection (disables single-key shortcuts when the user is typing in \`<input>\`, \`<textarea>\`, or contentEditable elements).

### Affected Areas
- [x] Frontend
- [x] UI/UX

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 1 (Easy / Beginner-friendly) (NSoC-L1)

---

## Acceptance Criteria
- [ ] Pressing \`?\` or \`Ctrl+/\` opens the keyboard shortcut modal with categorized shortcuts.
- [ ] Flashcard study screen supports \`Space\` to flip and \`1\`-\`4\` to grade.
- [ ] Shortcuts automatically disable when typing in text fields to prevent unintended actions.
- [ ] Fully accessible with ARIA attributes and keyboard trap handling.
- [ ] Unit tests for \`useKeyboardShortcuts\` verifying event listeners and input guards.
`
  },
  {
    number: 637,
    slug: 'haptic-audio-feedback-ambient-study-soundscapes',
    title: '[ENHANCEMENT]: Haptic & Audio Feedback Manager with Ambient Study Soundscape Presets',
    labels: ['enhancement', 'frontend', 'ui/ux', 'low-priority', 'NSoC', 'NSoC-L1'],
    body: `## Summary & Motivation
Auditory cues provide immediate positive reinforcement during high-stakes study sessions (e.g., answering a quiz correctly, completing a flashcard deck, or completing a Pomodoro cycle). Additionally, many students prefer calming background ambient audio (white noise, rain, coffee shop) to maintain deep focus.

This enhancement introduces a lightweight, zero-dependency **Audio & Soundscape Feedback System** built on top of the native Web Audio API with granular user preference toggles.

---

## Technical Scope & Architecture

### Frontend Implementation
1. **Web Audio Synthesizer Service (\`frontend/src/services/soundService.js\`)**:
   - Uses Web Audio API synthesis (oscillators + gain nodes) for lightweight UI micro-sounds without external MP3 asset network overhead:
     - \`playSuccessChime()\`: Ascending harmonic chime for correct quiz answers.
     - \`playFlipSound()\`: Subtle paper card flip frequency sweep.
     - \`playStreakFanfare()\`: Harmonized arpeggio upon milestone completion.
2. **Ambient Soundscape Player (\`frontend/src/components/audio/AmbientSoundscapePlayer.jsx\`)**:
   - Ambient noise generators (Brownian noise, pink noise, simulated rain) running in a Web Audio audio buffer node.
   - Master volume slider, mute toggle, and individual volume sliders for sound effects vs background ambience.
3. **User Preference Sync**:
   - Stores mute status and preferred volume in \`localStorage\` and merges with user profile settings.

### Affected Areas
- [x] Frontend
- [x] UI/UX

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 1 (Easy / Beginner-friendly) (NSoC-L1)

---

## Acceptance Criteria
- [ ] Synthesized audio chimes trigger upon quiz question validation and flashcard flip.
- [ ] Ambient soundscape controls allow continuous background playback with volume slider.
- [ ] Global Mute switch immediately halts all audio output.
- [ ] Audio settings persist across browser refreshes via \`localStorage\`.
- [ ] Respects user's \`prefers-reduced-motion\` / accessible audio preferences.
`
  },
  {
    number: 638,
    slug: 'interactive-api-docs-postman-bruno-collection-export',
    title: '[DOCS]: Comprehensive API Endpoint Documentation with Postman / Bruno Collection Export',
    labels: ['documentation', 'backend', 'devops', 'good first issue', 'low-priority', 'NSoC', 'NSoC-L1'],
    body: `## Summary & Motivation
As new contributors join OpenPrep AI through NSoC, onboarding friction occurs when developers need to understand authentication headers, request body schemas, and API responses for endpoints across auth, flashcards, quizzes, study plans, and AI services.

This task involves creating comprehensive, runnable API documentation, including an exported Postman/Bruno collection and an updated developer guide in \`docs/api-reference.md\`.

---

## Technical Scope & Architecture

### Documentation & Spec Artifacts
1. **API Reference Guide (\`docs/api-reference.md\`)**:
   - Comprehensive markdown breakdown of all REST API routes:
     - Authentication: \`POST /api/auth/register\`, \`POST /api/auth/login\`, \`POST /api/auth/refresh\`, \`POST /api/auth/logout\`.
     - Flashcards: \`GET /api/flashcards\`, \`POST /api/flashcards/generate\`, \`PUT /api/flashcards/:id/review\`.
     - Quiz & Battling: \`POST /api/quiz/create\`, \`POST /api/quiz/submit\`.
     - Study Planner: \`GET /api/study-plans\`, \`POST /api/study-plans/generate\`.
   - Each endpoint includes Request Headers, URL Parameters, JSON Request Schema, and Sample 200/400/401/500 JSON Responses.
2. **Postman & Bruno Collections**:
   - \`docs/openprep-api.postman_collection.json\`: v2.1 export with pre-configured Bearer token environment variables.
   - \`docs/bruno-collection/\`: Git-friendly Bruno API collection files for local development.

### Affected Areas
- [x] Backend
- [x] DevOps

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 1 (Easy / Beginner-friendly) (NSoC-L1)

---

## Acceptance Criteria
- [ ] Complete endpoint documentation in \`docs/api-reference.md\` covering all existing routes.
- [ ] Verified Postman Collection file with working pre-request auth scripts.
- [ ] Verified Bruno collection directory importable into Bruno client.
- [ ] Environment variable template (\`baseUrl\`, \`authToken\`) documented clearly.
`
  },
  {
    number: 639,
    slug: 'spaced-repetition-anki-apkg-deck-exporter-sqlite',
    title: '[FEATURE]: Spaced Repetition Anki (.apkg) Deck Importer & Exporter with SQLite Packager',
    labels: ['enhancement', 'flashcards', 'backend', 'frontend', 'medium-priority', 'NSoC', 'NSoC-L2'],
    body: `## Summary & Motivation
Anki is the gold standard desktop and mobile spaced repetition system with millions of active medical and STEM students. Students generating flashcards with OpenPrep AI frequently request the ability to export their generated cards directly into native Anki \`.apkg\` packages so they can review on AnkiDroid or AnkiMobile on the go.

This feature implements native **Anki .apkg Export and Import** using SQLite schema packaging and ZIP compression.

---

## Technical Scope & Architecture

### Backend Architecture
1. **Anki Packaging Service (\`backend/services/ankiService.js\`)**:
   - Generates valid Anki 2.1 SQLite databases (\`collection.anki2\` / \`collection.anki21\`):
     - Configures \`col\`, \`notes\`, and \`cards\` tables with standard Anki cloze and basic note models.
     - Maps OpenPrep AI card front, back, and hints into Anki note fields.
     - Bundles into a compressed \`.apkg\` ZIP archive containing the SQLite database and \`media\` JSON map.
2. **Anki Controller (\`backend/controllers/ankiController.js\`)**:
   - \`GET /api/flashcards/deck/:id/export/anki\`: Streams the generated \`.apkg\` file with \`Content-Disposition: attachment; filename="<deck-name>.apkg"\`.
   - \`POST /api/flashcards/import/anki\`: Parses uploaded \`.apkg\` files, extracts card notes, and persists them into the OpenPrep AI database.

### Frontend UI
1. **Export Modal Option (\`frontend/src/components/flashcards/ExportDeckModal.jsx\`)**:
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
- [ ] Users can export any flashcard deck as a valid \`.apkg\` file.
- [ ] Generated \`.apkg\` file imports cleanly into official Anki Desktop (v24.x) without errors.
- [ ] Importer parses Anki files and converts notes into OpenPrep flashcards.
- [ ] Unit tests for SQLite database generation and ZIP compression stream.
`
  },
  {
    number: 640,
    slug: 'interactive-syllabus-mastery-sunburst-chart-pyq-weightage',
    title: '[FEATURE]: Interactive Syllabus Mastery Sunburst Chart & PYQ Chapter Weightage Explorer',
    labels: ['enhancement', 'pyq-analysis', 'dashboard', 'frontend', 'medium-priority', 'NSoC', 'NSoC-L2'],
    body: `## Summary & Motivation
Preparing for competitive entrance examinations (e.g., JEE, NEET, GATE, UPSC) requires students to balance syllabus breadth against historical chapter mark distribution. Traditional linear chapter checklists fail to show hierarchical mastery (Subject -> Chapter -> Subtopic) correlated with past exam weightage.

This feature implements an **Interactive Sunburst & Radial Mastery Chart** that lets students drill down through their syllabus hierarchy while visually identifying high-yield, low-mastery knowledge gaps.

---

## Technical Scope & Architecture

### Frontend Implementation
1. **Hierarchical Sunburst Visualizer (\`frontend/src/components/analytics/SyllabusSunburstChart.jsx\`)**:
   - Built using Recharts or D3 hierarchy partition layout.
   - Inner ring: Subjects (Physics, Chemistry, Math).
   - Middle ring: Chapters (e.g. Thermodynamics, Electromagnetism).
   - Outer ring: Sub-topics (e.g. Carnot Engine, Entropy).
   - Color coding: Gradient from red (0% mastery) to emerald green (100% mastery).
   - Size of arc: Proportional to historical PYQ marks weightage (high-yield topics occupy larger angular slices).
2. **Interactive Topic Detail Drawer (\`frontend/src/components/analytics/TopicMasteryDrawer.jsx\`)**:
   - Clicking any slice zooms into that sub-tree and opens a slide-over panel displaying:
     - Total questions practiced vs accuracy rate.
     - Recommended flashcards and quiz questions for this node.
     - Historical exam appearance frequency (e.g. "Appeared in 8 of last 10 years").

### Affected Areas
- [x] Frontend
- [x] PYQ Analysis
- [x] Dashboard

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 2 (Medium / Intermediate) (NSoC-L2)

---

## Acceptance Criteria
- [ ] Renders multi-tiered radial sunburst chart with responsive resize support.
- [ ] Arc sizes correspond to historical weightage and colors represent mastery percentage.
- [ ] Clicking on a sector smoothly focuses on the sector and opens topic review details.
- [ ] Handles missing or partial study data gracefully with default fallbacks.
- [ ] Component unit tests verifying SVG rendering and click event callbacks.
`
  },
  {
    number: 641,
    slug: 'semantic-vector-deduplication-cross-deck-flashcards',
    title: '[ENHANCEMENT]: Semantic Vector Deduplication & Cross-Deck Flashcard Recommender',
    labels: ['enhancement', 'ai', 'flashcards', 'backend', 'medium-priority', 'NSoC', 'NSoC-L2'],
    body: `## Summary & Motivation
When generating flashcards automatically from lecture notes or textbooks across different study sessions, the AI model frequently generates redundant flashcards covering identical definitions phrased slightly differently. This bloats student review queues with duplicate work.

This enhancement implements **Semantic Vector Deduplication & Similarity Merging** using Gemini text embeddings and cosine similarity scoring.

---

## Technical Scope & Architecture

### Backend Architecture
1. **Deduplication Engine (\`backend/services/cardDeduplicationService.js\`)**:
   - Generates vector embeddings for card fronts and backs during batch card creation using Gemini Embedding API.
   - Computes pairwise cosine similarity between newly generated cards and existing cards in the user's decks.
   - Cards with cosine similarity > 0.88 are flagged as duplicates.
   - Automatically merges supplementary notes/examples from the duplicate into the canonical card or prompts the student with a comparison modal.
2. **API Endpoint (\`backend/controllers/flashcardController.js\`)**:
   - \`POST /api/flashcards/deck/:id/deduplicate\`: Scans deck for internal duplicates, returns similarity clusters with recommendations.
   - \`POST /api/flashcards/deck/:id/merge\`: Merges specified duplicate pairs into an enriched single card.

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
`
  },
  {
    number: 642,
    slug: 'multi-channel-study-notifications-telegram-discord',
    title: '[FEATURE]: Multi-Channel Study Notifications via Telegram Bot & Discord Webhook Integration',
    labels: ['enhancement', 'backend', 'study-planner', 'medium-priority', 'NSoC', 'NSoC-L2'],
    body: `## Summary & Motivation
Students do not keep the web application open 24/7. When spaced repetition reviews fall due or daily study streaks are in danger of resetting, sending timely notifications via platforms where students already spend their time (Telegram or Discord) dramatically improves study retention and daily active habits.

This feature adds support for **Telegram Bot & Discord Webhook Study Alerts** allowing students to receive their daily revision agenda and streak reminders externally.

---

## Technical Scope & Architecture

### Backend Implementation
1. **Notification Dispatcher Service (\`backend/services/externalNotificationService.js\`)**:
   - Modular notification dispatcher supporting:
     - **Discord Webhook**: Sends formatted rich embeds displaying daily pending cards, upcoming mock exam countdown, and motivational quote.
     - **Telegram Bot**: Sends Markdown messages with inline interactive buttons to quickly "Review 10 Cards Now" or "Extend Streak Freeze".
2. **Cron Scheduler Integration (\`backend/jobs/studyReminderJob.js\`)**:
   - Runs daily at student's configured reminder time (accounting for user timezone).
   - Checks if user has pending spaced repetition cards due for review or unfulfilled daily targets.
3. **User Notification Settings API**:
   - \`PUT /api/users/notifications/integrations\`: Stores encrypted webhook URLs or Telegram chat IDs with test dispatch capability.

### Affected Areas
- [x] Backend
- [x] Study Planner

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 2 (Medium / Intermediate) (NSoC-L2)

---

## Acceptance Criteria
- [ ] Users can save and test a Discord webhook URL from their profile settings.
- [ ] Users can connect their Telegram account via bot token/chat ID.
- [ ] Daily cron task dispatches formatted reminders to configured channels.
- [ ] Failed webhook deliveries are logged and back off without crashing background scheduler.
- [ ] Unit tests for message formatting and webhook payload delivery.
`
  },
  {
    number: 643,
    slug: 'real-time-1v1-speed-quiz-battle-arena-websockets-elo',
    title: '[FEATURE]: Real-Time 1v1 Speed Quiz Battle Arena with WebSocket Matchmaking & ELO Leaderboard',
    labels: ['enhancement', 'quiz-system', 'backend', 'frontend', 'high-priority', 'NSoC', 'NSoC-L3'],
    body: `## Summary & Motivation
Gamified peer competition accelerates question-solving speed and exam readiness. Students frequently request a real-time multiplayer mode where they can duel peers or study group partners in rapid-fire 10-question speed battles under synchronized timers.

This feature introduces the **Real-Time 1v1 Speed Quiz Battle Arena**, featuring WebSocket-driven matchmaking, synchronized question clocks, live differential progress bars, and ELO rating adjustments.

---

## Technical Scope & Architecture

### Backend & Socket Architecture
1. **Matchmaking & Room Manager (\`backend/sockets/quizBattleSocket.js\` & \`backend/services/quizBattleService.js\`)**:
   - In-memory matchmaking queue grouping players by subject and similar ELO rating (+/- 200 rating).
   - Generates synchronized battle sessions with identical randomized question sequences.
   - Synchronized round clock with authoritative server-side timestamps to prevent client clock tampering.
   - Computes standard chess ELO rating delta upon match conclusion and updates user leaderboard standings.
2. **Socket Events**:
   - \`battle:join_queue\`, \`battle:matched\`, \`battle:answer_submitted\`, \`battle:opponent_progress\`, \`battle:round_ended\`, \`battle:disconnect\`.

### Frontend Implementation
1. **Live Battle Arena Page (\`frontend/src/pages/BattleArena.jsx\`)**:
   - Split-screen HUD: Left player vs Right opponent avatar with live dynamic HP/score bars.
   - Synchronized 15-second radial countdown timer per question.
   - Instant visual indicator when opponent locks in an answer.
   - Post-match victory/defeat screen showing ELO gain/loss, question review breakdown, and "Rematch" button.

### Affected Areas
- [x] Frontend
- [x] Backend
- [x] Quiz System

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 3 (Hard / Advanced) (NSoC-L3)

---

## Acceptance Criteria
- [ ] Two concurrent players can queue, match, and enter a shared battle room via WebSockets.
- [ ] Questions and timers are synchronized by the server.
- [ ] Both players see real-time score updates as answers are submitted.
- [ ] Disconnections handle graceful forfeiture or reconnection within a 15-second grace period.
- [ ] ELO ratings recalculate and persist in the database upon battle completion.
`
  },
  {
    number: 644,
    slug: 'multimodal-math-science-diagram-ocr-solver-katex',
    title: '[FEATURE]: Multimodal Math & Science Diagram OCR Solver with Interactive KaTeX Derivations',
    labels: ['enhancement', 'ai', 'frontend', 'backend', 'high-priority', 'NSoC', 'NSoC-L3'],
    body: `## Summary & Motivation
Students studying Physics, Mathematics, and Engineering encounter complex problems containing geometry figures, circuit diagrams, chemical structures, and multi-line differential equations. Typing these manually into a text prompt is nearly impossible.

This feature implements a **Multimodal Math & Science Diagram OCR Solver** powered by Gemini Vision, parsing uploaded photos or camera snaps of textbook problems and outputting structured step-by-step LaTeX derivations with interactive formula scratchpads.

---

## Technical Scope & Architecture

### Backend AI Pipeline
1. **Multimodal Analysis Service (\`backend/services/diagramOcrService.js\`)**:
   - Ingests image buffers (JPEG, PNG, WebP) with strict input validation and image compression.
   - Calls Google Gemini 1.5 Pro / Flash Vision model with tailored system instruction:
     - Transcribes problem statement into clean Markdown + KaTeX math syntax.
     - Identifies known variables, target unknown, and governing physical laws/theorems.
     - Generates step-by-step mathematical derivation with every intermediate algebraic transition explained.
     - Flags common pitfall traps or units conversion errors.
2. **API Endpoint (\`backend/routes/aiRoutes.js\`)**:
   - \`POST /api/ai/solve-diagram\` with \`multipart/form-data\` image payload and optional subject hint.

### Frontend Interface
1. **Camera Capture & Crop Utility (\`frontend/src/components/ocr/ProblemImageCapture.jsx\`)**:
   - Supports webcam capture, file drag-and-drop, and client-side bounding-box cropping.
2. **Derivation Step Inspector (\`frontend/src/components/ocr/DerivationViewer.jsx\`)**:
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
`
  },
  {
    number: 645,
    slug: 'offline-first-pwa-background-sync-indexeddb-crdt',
    title: '[FEATURE]: Offline-First PWA Background Sync with IndexedDB & Vector State Conflict Resolution',
    labels: ['enhancement', 'frontend', 'backend', 'database', 'high-priority', 'NSoC', 'NSoC-L3'],
    body: `## Summary & Motivation
Students often study in environments with spotty or zero internet access (e.g., subway commutes, flights, rural locations, campus library basements). If the application becomes unusable without an active network, students lose precious study momentum.

This feature transforms OpenPrep AI into a true **Offline-First Progressive Web App (PWA)**, allowing students to review flashcards, solve practice quizzes, and take notes completely offline, with automatic Background Sync and conflict-free data synchronization once connectivity resumes.

---

## Technical Scope & Architecture

### Frontend Offline Architecture
1. **Service Worker & Workbox Caching (\`frontend/public/service-worker.js\` & \`frontend/src/serviceWorkerRegistration.js\`)**:
   - Cache-first strategy for static assets (Vite JS/CSS bundles, fonts, SVG icons).
   - Network-first with IndexedDB fallback for API calls.
2. **IndexedDB Local Storage Engine (\`frontend/src/services/offlineStorageService.js\`)**:
   - Uses \`idb\` wrapper to persist decks, flashcards, pending review logs, and quiz results locally.
   - Outbox mutation queue: Any offline action (e.g. card graded "Easy") is appended to an \`outbox_mutations\` IndexedDB store with a monotonic local timestamp.
3. **Background Sync & Conflict Resolution (\`frontend/src/services/syncManager.js\`)**:
   - Registers \`sync\` event with the browser's ServiceWorker \`SyncManager\`.
   - Upon connection restoration, flushes queued outbox mutations to backend in batch (\`POST /api/sync/batch\`).
   - Implements Last-Write-Wins (LWW) with server revision clocks to prevent overwriting updates made from other devices.

### Backend Synchronization Endpoint
1. **Batch Sync Controller (\`backend/controllers/syncController.js\`)**:
   - \`POST /api/sync/batch\`: Atomic transaction processing queued client mutations and returning updated entity states.

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
`
  }
];

// 1. Write markdown files to issues/ directory
console.log('Writing issue markdown files to issues/ directory...');
for (const item of nsocIssues) {
  const filename = `issue-${item.number}-${item.slug}.md`;
  const filePath = path.join(issuesDir, filename);

  const fileContent = `---
title: '${item.title}'
labels: '${item.labels.join(', ')}'
assignees: ''
---

${item.body}
`;

  fs.writeFileSync(filePath, fileContent, 'utf8');
  console.log(`[SAVED] ${filename}`);
}

// 2. Fetch existing issues on GitHub to avoid duplicates
let existingTitles = [];
try {
  const jsonStr = execSync('gh issue list --repo nishit546/OpenPrep-AI --state all --limit 200 --json title', { encoding: 'utf8' });
  existingTitles = JSON.parse(jsonStr).map(i => i.title.trim().toLowerCase());
} catch (e) {
  console.log('Warning: could not fetch existing issues via gh:', e.message);
}

// 3. Create issues on GitHub
let createdCount = 0;
let skippedCount = 0;

for (let i = 0; i < nsocIssues.length; i++) {
  const item = nsocIssues[i];
  const normalizedTitle = item.title.trim().toLowerCase();

  if (existingTitles.includes(normalizedTitle)) {
    console.log(`[SKIP] Already exists: "${item.title}"`);
    skippedCount++;
    continue;
  }

  const tempBodyPath = path.join(__dirname, `temp_nsoc_${item.number}.md`);
  fs.writeFileSync(tempBodyPath, item.body, 'utf8');

  const labelArgs = item.labels.map(l => `--label "${l}"`).join(' ');
  const escapedTitle = item.title.replace(/"/g, '\\"');
  const cmd = `gh issue create --title "${escapedTitle}" --body-file "${tempBodyPath}" ${labelArgs}`;

  console.log(`\n[${i + 1}/${nsocIssues.length}] Creating GitHub Issue: "${item.title}"`);
  console.log(`Labels: ${item.labels.join(', ')}`);

  try {
    const output = execSync(cmd, { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
    console.log(`[SUCCESS] -> ${output.trim()}`);
    createdCount++;
    existingTitles.push(normalizedTitle);
  } catch (err) {
    console.error(`[ERROR] Failed to create issue ${item.number}:`, err.stdout || err.stderr || err.message);
  } finally {
    if (fs.existsSync(tempBodyPath)) {
      fs.unlinkSync(tempBodyPath);
    }
  }

  // Brief pause to prevent rate limiting
  execSync('node -e "setTimeout(() => {}, 2000)"');
}

console.log(`\n================================================================================`);
console.log(`Batch Issue Creation Complete!`);
console.log(`- Total Processed: ${nsocIssues.length}`);
console.log(`- Newly Created on GitHub: ${createdCount}`);
console.log(`- Already Existing (Skipped): ${skippedCount}`);
console.log(`================================================================================`);
