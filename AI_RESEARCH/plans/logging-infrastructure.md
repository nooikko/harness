# Logging Infrastructure Plan

## Status: APPROVED (2026-03-19)

## Context

Harness is an autonomous orchestration system with bypass permissions, SSH access to ~10 machines, email/calendar/health data access, and delegation chains spawning sub-agents. The logging must match that trust level — this is the audit trail for an autonomous system operating on sensitive data.

The self-building loop requires: Harness modifies its own code in a worktree, builds a Docker image, deploys it, tests via Playwright, and diagnoses failures from server-side logs. The AI agent needs to programmatically query structured logs to determine what went wrong.

## Current State

- **Logger:** Pino 10.3.1 with custom wrapper (`packages/logger/`)
- **Transports:** pino-pretty (dev), pino/file (prod), JSON stdout (fallback)
- **Correlation:** traceId + threadId bound per-pipeline via child loggers
- **Error persistence:** ErrorLog PostgreSQL table (fire-and-forget, error/warn only)
- **Gaps:** No log rotation, no HTTP request logging, no log aggregation, no pluginName binding, no Next.js coverage, no programmatic query interface

## Architecture Decision

**Dual-write: rotating files + Loki.**

- Logs always go to rotating JSON files via pino-roll (durable, zero-dependency baseline)
- Loki is the query/index layer for fast structured search across concurrent interleaved traces
- If Loki is down, the MCP tool falls back to file scanning — slower but functional
- Both run simultaneously via Pino multi-target transport

**Why Loki is justified:** This isn't a typical single-container app. 20+ plugins, concurrent pipeline runs, delegation chains (parent → child → validator → retry), cron jobs firing simultaneously, fire-and-forget async work — all interleaved in the same log stream. Flat file grep on threadId works for simple cases but falls apart when three cron jobs fire while a delegation chain runs and a user chats. LogQL provides indexed, structured queries across all of that.

## Phase 1: Logger Hardening + Rotation

### 1a. Replace pino/file with pino-roll

Current `buildTransport` returns `pino/file` when `LOG_FILE` is set. Replace with pino-roll multi-target:

- **Info+ log:** `{LOG_FILE}` — daily rotation + 100MB size cap, 7 files kept (~700MB max)
- **Error-only log:** `{LOG_FILE}.error` — daily rotation, 14 files kept (errors retained longer)
- **Symlink:** `current.log` always points to active file for predictable reads

Config: `frequency: 'daily'`, `size: '100m'`, `dateFormat: 'yyyy-MM-dd'`, `symlink: true`, `limit: { count: 7 }`, `mkdir: true`

### 1b. Add pluginName to child loggers

When the orchestrator constructs PluginContext for each plugin, create a per-plugin child logger with `pluginName` bound. Every log line from a plugin self-identifies its source without the plugin having to remember to include it.

### 1c. Add pino-http middleware

Add `pino-http` to the web plugin's Express server. Logs every HTTP request/response with: method, path, status code, response time, requestId (auto-generated).

### 1d. Add logger flush on shutdown

The orchestrator's shutdown sequence needs to flush the Pino transport before `process.exit`. Without this, the last batch of pino-roll writes (and pino-loki batches) may be lost. Add `rootLogger.flush()` (or expose a `flush` function from the logger package) in the shutdown handler.

**Dependencies:** `pino-roll`, `pino-http`
**Files:** `packages/logger/src/index.ts`, `packages/logger/src/env.ts`, `packages/logger/package.json`, `apps/orchestrator/src/orchestrator/index.ts`, `apps/orchestrator/src/index.ts`, `packages/plugins/web/src/index.ts`
**Complexity:** Low-Medium
**Risk:** Low

## Phase 2: Loki Infrastructure

### 2a. Add Loki to docker-compose.yml

```yaml
loki:
  image: grafana/loki:3.4.3
  ports:
    - "3100:3100"
  volumes:
    - loki-data:/loki
  command: -config.file=/etc/loki/local-config.yaml
```

Grafana is optional — the agent queries Loki's HTTP API directly. Include it for human debugging but it's not required for the self-build loop.

### 2b. Add pino-loki transport

When `LOKI_URL` is set, add pino-loki as an additional transport target alongside pino-roll. Both run simultaneously — Pino multi-target handles this natively.

```typescript
// Add to transport targets array when LOKI_URL is set
{
  target: 'pino-loki',
  level: 'info',
  options: {
    host: env.LOKI_URL,
    labels: { app: 'harness', service: prefix },
    batching: true,
    interval: 2,
  },
}
```

Labels enable LogQL queries: `{app="harness", service="orchestrator"} | json | threadId="abc" | level="error"`

### 2c. Graceful degradation

- `LOKI_URL` not set = no Loki transport, file-only (zero behavior change from Phase 1)
- Loki unreachable = pino-loki buffers in memory, logs still go to files
- Loki down at boot = same as above, transport reconnects when available

**Dependencies:** `pino-loki`
**Files:** `packages/logger/src/index.ts`, `packages/logger/src/env.ts`, `packages/logger/package.json`, `docker-compose.yml`, `.env.example`
**Complexity:** Medium
**Risk:** Low — additive, optional via env var

## Phase 3: Log Query MCP Tool

New plugin `@harness/plugin-logs` with one MCP tool:

```
logs__query — Search structured logs from the running Harness instance
Input: {
  level?: "error" | "warn" | "info" | "debug",  // minimum level filter
  source?: string,       // pluginName filter (e.g., "identity", "cron")
  threadId?: string,     // filter by thread
  traceId?: string,      // filter by trace
  search?: string,       // text search in message field
  since?: string,        // time range: "5m", "1h", "2h" (default: "15m")
  limit?: number,        // max lines returned (default: 100)
  errorsOnly?: boolean,  // read from error log file (faster for diagnosis)
}
Output: formatted log lines matching all filters
```

**Query backend priority:**
1. If `LOKI_URL` is set → query Loki HTTP API (`/loki/api/v1/query_range`) with LogQL
2. Fallback → streaming line-by-line read of JSON log files, parse + filter, collect up to `limit` matches

When `errorsOnly: true`, reads from the `.error.log` file (or Loki with `| level="error"`) — much smaller, faster scan.

**Files:** New `packages/plugins/logs/` package, register in `ALL_PLUGINS`
**Complexity:** Medium
**Risk:** Low — tool-only plugin, no hooks, no pipeline impact

## Phase 4: Playwright-to-Log Correlation

**The correlation mechanism: threadId + time window.**

1. Playwright test navigates to a thread page — `threadId` is in the URL (`/chat/{threadId}`)
2. Test performs an action (send message, click button)
3. On failure, agent queries: `logs__query({ threadId: "xxx", since: "5m", level: "error" })`

Every orchestrator log line already has `threadId` bound via child loggers. This is sufficient correlation.

**For cases with no threadId** (e.g., thread creation fails, page load errors):
- Query by time window + error level: `logs__query({ since: "2m", level: "error" })`
- Playwright captures browser console + network tab — those show the failed server action response

**Implementation:** Mostly prompt engineering in the `logs__query` tool description so the agent knows the diagnostic pattern. Ensure threadId is consistently bound on all log lines (verified in Phase 1b).

**Complexity:** Low
**Risk:** Low

## Phase 5: Next.js Log Coverage

**The problem:** `apps/web/` doesn't use `@harness/logger`. Server action failures go to Next.js stdout in unstructured format, invisible to Loki and the log files.

**Approach (try in order):**

**Option A (preferred):** Add `@harness/logger` as dependency of `apps/web/`. Use it in server actions (which run in Node.js, not edge). Set `LOG_FILE` in the Next.js process env so it writes to the same log directory. Pino transports use worker threads which should work in Node.js server actions but may conflict with Next.js module bundling.

**Option B (fallback):** If transport workers cause bundling issues, server actions catch errors and write directly to the ErrorLog DB table via Prisma (already available in server actions). Less structured than Option A but captures the failures.

**Files:** `apps/web/package.json`, new `apps/web/src/lib/logger.ts` utility, wrap key server actions with structured error logging
**Complexity:** Medium (bundling unknowns)
**Risk:** Medium — may need Option B

## Dependency Graph

```
Phase 1 (Logger Hardening + Rotation)
    ↓
Phase 2 (Loki) ← can start in parallel with Phase 1
    ↓
Phase 3 (MCP Query Tool) ← depends on Phase 1 (files) or Phase 2 (Loki)
    ↓
Phase 4 (Playwright Correlation) ← depends on Phase 3

Phase 5 (Next.js Coverage) ← independent, can parallel with Phase 2/3
```

## Volume Estimates

| Scenario | Daily Volume | Rotation Behavior | Disk Cap |
|---|---|---|---|
| Idle | 2-5 MB | Daily rotation only | ~35 MB (7 files) |
| Active (1 user) | 12-36 MB | Daily rotation only | ~250 MB (7 files) |
| Heavy (crons + delegation + SSH) | 70-150 MB | 1-2 size rotations + daily | ~700 MB (7 x 100MB) |
| Error log | 0.1-5 MB | Daily only | ~70 MB (14 files) |

## What's NOT in This Plan

- **OpenTelemetry/distributed tracing** — overkill for single-instance; traceId correlation is sufficient
- **Log-based alerting** — not needed for self-build loop diagnostics
- **Grafana dashboards** — agent queries Loki directly; dashboards are for humans (optional add)
- **Boot crash handling** — absence of output is the signal; no special infra needed
- **Build-time logs** — captured by `docker build` stdout, separate from runtime logging
- **Log retention policies** — pino-roll file count limits + Loki default retention are sufficient
