---
title: '[PERFORMANCE]: Redis Dynamic Query Caching & Stale-While-Revalidate for Leaderboards & PYQ Analytics'
labels: 'performance, backend, database, redis, medium-priority, NSoC, NSoC-L2'
assignees: ''
---

## Summary & Motivation
As OpenPrep AI scales to thousands of concurrent users preparing for high-stakes exams, complex aggregate queries—such as Global and Study Squad Leaderboards, Subject Weakness Heatmaps, and PYQ Chapter Weightage distributions—trigger multi-table PostgreSQL joins and grouping operations that degrade response times from 45ms to upwards of 1800ms.

This issue implements a centralized **Redis Caching Middleware** utilizing the **Stale-While-Revalidate (SWR)** caching pattern with distributed cache invalidation hooks to deliver sub-10ms reads on heavy analytical queries while preventing cache thundering herds.

---

## Technical Scope & Architecture

### 1. Redis Caching Engine (`backend/services/cacheService.js`)
- Configures `ioredis` with automatic cluster reconnects, exponential backoff, and circuit breaker patterns.
- Implements two-tiered key namespaces:
  - `cache:leaderboard:global:{period}` (TTL: 15 mins)
  - `cache:pyq:weightage:{subjectId}:{yearRange}` (TTL: 24 hours)
  - `cache:user:analytics:{userId}` (TTL: 1 hour)
- Implements SWR logic:
  - Serves cached data instantly if within standard TTL.
  - If between soft TTL and hard TTL, returns stale payload immediately and enqueues an asynchronous background job to recompute and update the cache without blocking the HTTP request.

### 2. Cache Invalidation Middleware (`backend/middleware/cacheMiddleware.js`)
- Express middleware wrapper `cacheResponse(ttlSeconds, swrGraceSeconds, tagExtractor)`.
- Event-driven cache purging:
  - On new quiz attempt logged: invalidates specific `user:analytics:{userId}` and flags leaderboard tags for re-sync.
  - On new PYQ paper uploaded: purges `pyq:weightage:{subjectId}:*`.

### 3. Monitoring & Telemetry
- Tracks cache hit ratios, cache misses, and memory eviction counters exposed to `/metrics` for Prometheus scraping.

### Affected Areas
- [x] Backend
- [x] Database
- [x] DevOps

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 2 (Medium) (NSoC-L2)

---

## Acceptance Criteria
- [ ] Redis caching middleware cleanly wraps read-heavy controllers without code duplication.
- [ ] Analytical endpoint p95 latency drops from >1200ms to <20ms under benchmarked cached loads.
- [ ] Stale-While-Revalidate serves instant responses during background cache recomputations.
- [ ] Mutation endpoints (submitting quizzes, uploading papers) trigger precise cache tag invalidation.
- [ ] Gracefully falls back to direct database execution if Redis is offline or unreachable.
- [ ] Unit tests with mocked Redis client testing TTL expiry, SWR grace periods, and invalidation triggers.
