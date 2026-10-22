---
title: '[DEVOPS]: OpenTelemetry Distributed Tracing & Prometheus Latency SLO Alerting Pipeline'
labels: 'devops, backend, monitoring, medium-priority, NSoC, NSoC-L2'
assignees: ''
---

## Summary & Motivation
When AI endpoints or database queries encounter latency spikes, debugging across multiple asynchronous micro-operations (PDF parsing, OCR, Gemini API invocations, PostgreSQL queries, Redis cache lookups) requires manually sifting through raw server logs. There is no end-to-end visibility into where request time is spent.

This issue implements an **OpenTelemetry (OTel) Distributed Tracing Pipeline** paired with **Prometheus Metrics** and SLO (Service Level Objective) latency alerting to identify performance bottlenecks in real-time.

---

## Technical Scope & Architecture

### 1. OpenTelemetry Instrumentation (`backend/instrumentation.js`)
- Initializes OpenTelemetry Node.js SDK prior to application boot:
  - Auto-instrumentation for `http`, `express`, `pg` (PostgreSQL), `ioredis`, and external `fetch` / Axios calls.
- Creates custom trace spans for AI operations:
  - `span: ai.gemini.generate_quiz` (attributes: prompt_tokens, model, duration_ms)
  - `span: pdf.extract_text` (attributes: page_count, file_size_bytes)
  - `span: cache.lookup` (attributes: key, hit_or_miss)
- Exports trace spans via OTLP / gRPC to collector (Grafana Tempo or Jaeger).

### 2. Prometheus Metrics & Custom Collectors (`backend/services/metricsService.js`)
- Registers standard and custom metric instruments:
  - `http_request_duration_seconds` (histogram with p50, p90, p99 buckets)
  - `ai_token_usage_total` (counter by user_tier and operation)
  - `study_session_active_gauge` (gauge of active real-time users)
  - `cache_hit_ratio` (counter)
- Secure `/metrics` endpoint guarded by basic auth or internal network VPC access.

### 3. Grafana Dashboard & Alerting Rules (`docker/monitoring/alert_rules.yml`)
- SLO Alert 1: AI generation p95 latency > 8.0s over 5 minutes.
- SLO Alert 2: HTTP 5xx error rate > 1.0% over 2 minutes.
- SLO Alert 3: Database connection pool exhaustion > 90% capacity.

### Affected Areas
- [x] DevOps
- [x] Backend
- [x] Monitoring

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 2 (Medium) (NSoC-L2)

---

## Acceptance Criteria
- [ ] OpenTelemetry SDK initializes cleanly without adding perceptible request latency overhead (<2ms).
- [ ] Custom spans accurately capture nested durations for AI and PDF processing pipelines.
- [ ] `/metrics` endpoint exports valid Prometheus text format metrics.
- [ ] Grafana dashboard JSON provided for quick local visualization in Docker Compose.
- [ ] Unit tests for custom metric increments and span lifecycle handling.
