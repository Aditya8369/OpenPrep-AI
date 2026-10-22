---
title: '[FEATURE]: Collaborative Study Squads with WebRTC Audio Lounge & Shared Pomodoro Synchronizer'
labels: 'enhancement, frontend, backend, websockets, webrtc, NSoC, NSoC-L3'
assignees: ''
---

## Summary & Motivation
Studying in isolation often leads to procrastination and burnout. Students frequently use external Discord calls or Zoom links while studying together, creating a fragmented workflow.

This feature introduces a native **Study Squad Virtual Lounge** inside OpenPrep AI. Students can join virtual study rooms with low-latency WebRTC mesh voice audio, real-time presence indicators, customizable ambient background audio (Lo-Fi beats, library rain, white noise), and a synchronized Pomodoro timer shared across all room participants via WebSockets.

---

## Technical Scope & Architecture

### 1. Signaling & WebRTC Voice Mesh (`backend/socket/studyRoomSocket.js`)
- WebSocket events for room discovery, join, leave, and SDP offer/answer/ICE candidate relay:
  - `room:join`, `room:peer-joined`, `webrtc:signal`, `room:peer-left`.
- WebRTC mesh topology optimized for small study pods (up to 6 peers) with auto-mute, push-to-talk, and speaking activity indicators.

### 2. Synchronized Room Pomodoro Engine
- Server-authoritative timer: Room host starts a 25-minute study sprint or 5-minute break.
- Server broadcasts timestamp sync pulses (`room:timer-sync`) so all participants' countdown clocks remain synchronized within <100ms drift.
- Automatic transition chimes and distraction-free "Focus Mode" dimming.

### 3. Frontend Room Interface (`frontend/src/components/studySquad/StudyLounge.jsx`)
- Member avatar grid showing active microphone state (muted, speaking, deafened).
- Integrated ambient audio mixer: Sliders for Binaural Beats, Rain, Cafe murmur, and Lo-Fi study tracks.
- "Doubt Scratchpad": Shared minimalist text/formula clipboard for quick peer questions during breaks.

### Affected Areas
- [x] Frontend
- [x] Backend
- [x] WebSockets
- [x] WebRTC

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 3 (Hard / Advanced) (NSoC-L3)

---

## Acceptance Criteria
- [ ] Users can create and join private or public Study Squad rooms via shareable invite links.
- [ ] WebRTC peer-to-peer audio connection establishes reliably with clear audio and mute controls.
- [ ] Room Pomodoro timer stays synchronized across all connected client tabs.
- [ ] Ambient soundscapes mix cleanly with incoming voice streams without clipping or distortion.
- [ ] Unit and mock tests for WebSocket signaling events and disconnect cleanup.
