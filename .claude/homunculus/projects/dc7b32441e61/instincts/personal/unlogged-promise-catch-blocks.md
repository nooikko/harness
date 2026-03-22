---
id: unlogged-promise-catch-blocks
trigger: when reviewing code with .catch() blocks, void async IIFE, or fire-and-forget promises
confidence: 0.85
domain: debugging
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Unlogged Promise Catch Blocks

## Action
All `.catch()` blocks in plugins must log errors before swallowing them, or re-throw to propagate. Never use `.catch(() => {})` or `.catch(() => undefined)` without logging.

## Evidence
- Observed 11+ times across 6 plugins in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Promise chains (from async operations, API calls, DB updates) end with `.catch()` that suppresses errors without visibility
- Files affected: delegation (3), cron (3), web (1), music (1), search (2), orchestrator (3)
- Last observed: 2026-03-17 during comprehensive error handling audit
- Root cause identified: no structured error logging, fire-and-forget pattern without error visibility

## Why This Matters
- Silent failures hide bugs during development and production
- Plugin errors go undetected by monitoring/alerting
- Fire-and-forget tasks (background DB writes, retries, async loops) need logging for observability
- Makes it impossible to diagnose why plugins silently stop working

## Correct Pattern
Log errors before suppressing:
```typescript
// Bad
promise.catch(() => {});
void asyncFn();  // If asyncFn fails, no one knows

// Good
promise.catch((err: unknown) => {
  ctx.logger.error(`operation failed: ${err instanceof Error ? err.message : String(err)}`);
});

// Or re-throw for upstream handling
promise.catch((err) => {
  ctx.logger.warn(`background task failed: ${err}`);
  return undefined;  // Explicit intent to suppress, but logged
});
```

This aligns with the Phase 2.5 error handling overhaul and the logger upgrade to Pino for structured logging.
