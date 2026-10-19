---
title: '[FEATURE]: Multi-Channel Study Notifications via Telegram Bot & Discord Webhook Integration'
labels: 'enhancement, backend, study-planner, medium-priority, NSoC, NSoC-L2'
assignees: ''
---

## Summary & Motivation
Students do not keep the web application open 24/7. When spaced repetition reviews fall due or daily study streaks are in danger of resetting, sending timely notifications via platforms where students already spend their time (Telegram or Discord) dramatically improves study retention and daily active habits.

This feature adds support for **Telegram Bot & Discord Webhook Study Alerts** allowing students to receive their daily revision agenda and streak reminders externally.

---

## Technical Scope & Architecture

### Backend Implementation
1. **Notification Dispatcher Service (`backend/services/externalNotificationService.js`)**:
   - Modular notification dispatcher supporting:
     - **Discord Webhook**: Sends formatted rich embeds displaying daily pending cards, upcoming mock exam countdown, and motivational quote.
     - **Telegram Bot**: Sends Markdown messages with inline interactive buttons to quickly "Review 10 Cards Now" or "Extend Streak Freeze".
2. **Cron Scheduler Integration (`backend/jobs/studyReminderJob.js`)**:
   - Runs daily at student's configured reminder time (accounting for user timezone).
   - Checks if user has pending spaced repetition cards due for review or unfulfilled daily targets.
3. **User Notification Settings API**:
   - `PUT /api/users/notifications/integrations`: Stores encrypted webhook URLs or Telegram chat IDs with test dispatch capability.

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

