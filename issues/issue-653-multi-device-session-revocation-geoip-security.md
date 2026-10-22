---
title: '[SECURITY]: Multi-Device Concurrent Session Manager, Remote Revocation & Suspicious GeoIP Alerts'
labels: 'security, backend, database, high-priority, NSoC, NSoC-L2'
assignees: ''
---

## Summary & Motivation
Currently, OpenPrep AI uses stateless JWTs without active server-side session tracking. If a student logs in from a public library computer or shared campus device and forgets to log out, or if an access token is leaked, there is no way to revoke that specific session without invalidating all tokens globally or waiting for expiration.

This issue implements a **Stateful Multi-Device Session Management Engine**, allowing students to view all active logins (device, browser, IP, location, last active timestamp), selectively terminate unfamiliar sessions, and receive security alerts upon detection of concurrent logins from distant geographical locations (impossible travel).

---

## Technical Scope & Architecture

### 1. Database Schema (`backend/models/UserSession.js`)
- Creates `user_sessions` table:
  - `id` (UUID, primary key)
  - `userId` (foreign key to `users`)
  - `refreshTokenHash` (SHA-256 hashed token)
  - `deviceFingerprint` (User-Agent, browser, OS)
  - `ipAddress` (IPv4 / IPv6)
  - `geoCountry`, `geoCity`, `latitude`, `longitude`
  - `isRevoked` (boolean)
  - `lastActiveAt`, `expiresAt`

### 2. Session Middleware & GeoIP Verification (`backend/middleware/sessionManager.js`)
- On token issue or refresh:
  - Resolves client IP to approximate location using `geoip-lite` or MaxMind DB.
  - Implements **Impossible Travel Detection**: Flags an alert if a session was active in Mumbai and 10 minutes later is accessed from London.
  - Validates session UUID in incoming JWT claims against Redis session bloom filter / whitelist table.

### 3. Account Security Endpoints (`backend/controllers/authController.js`)
- `GET /api/auth/sessions`: Lists all active devices with current session highlighted.
- `DELETE /api/auth/sessions/:sessionId`: Revokes a specific remote session.
- `DELETE /api/auth/sessions/others`: "Log out of all other devices" action.

### 4. Frontend Security Center (`frontend/src/pages/AccountSecurity.jsx`)
- Session management card showing device icon (Desktop, Mobile, Tablet), browser version, location badge, and "Revoke" button.
- Security alert banner on login if a new unrecognized device/location was used.

### Affected Areas
- [x] Backend
- [x] Security
- [x] Database
- [x] Frontend

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 2 (Medium) (NSoC-L2)

---

## Acceptance Criteria
- [ ] Users can view a list of all active sessions with device details and approximate location.
- [ ] Revoking a session immediately invalidates the associated refresh and access tokens.
- [ ] "Log out of all other devices" cleanly terminates all remote sessions except current.
- [ ] Impossible travel velocity anomalies trigger an email notification and optional session freeze.
- [ ] Unit and integration tests for session creation, validation, expiration, and revocation.
