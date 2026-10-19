---
title: '[FEATURE]: Real-Time 1v1 Speed Quiz Battle Arena with WebSocket Matchmaking & ELO Leaderboard'
labels: 'enhancement, quiz-system, backend, frontend, high-priority, NSoC, NSoC-L3'
assignees: ''
---

## Summary & Motivation
Gamified peer competition accelerates question-solving speed and exam readiness. Students frequently request a real-time multiplayer mode where they can duel peers or study group partners in rapid-fire 10-question speed battles under synchronized timers.

This feature introduces the **Real-Time 1v1 Speed Quiz Battle Arena**, featuring WebSocket-driven matchmaking, synchronized question clocks, live differential progress bars, and ELO rating adjustments.

---

## Technical Scope & Architecture

### Backend & Socket Architecture
1. **Matchmaking & Room Manager (`backend/sockets/quizBattleSocket.js` & `backend/services/quizBattleService.js`)**:
   - In-memory matchmaking queue grouping players by subject and similar ELO rating (+/- 200 rating).
   - Generates synchronized battle sessions with identical randomized question sequences.
   - Synchronized round clock with authoritative server-side timestamps to prevent client clock tampering.
   - Computes standard chess ELO rating delta upon match conclusion and updates user leaderboard standings.
2. **Socket Events**:
   - `battle:join_queue`, `battle:matched`, `battle:answer_submitted`, `battle:opponent_progress`, `battle:round_ended`, `battle:disconnect`.

### Frontend Implementation
1. **Live Battle Arena Page (`frontend/src/pages/BattleArena.jsx`)**:
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

