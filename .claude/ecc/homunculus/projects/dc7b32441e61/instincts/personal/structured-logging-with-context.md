---
id: structured-logging-with-context
trigger: when logging errors in helper functions
confidence: 0.5
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Structured Logging with Context

## Action
Include a context object as the second parameter to logger methods to provide structured, queryable context for errors.

## Evidence
- Observed 4 times in session 31c444d9-8205-4bd5-af0b-09f5495a3367
- Pattern: Error logs include a context object with relevant identifiers (e.g., `{ taskId, threadId, iteration, maxIterations }` or `{ stack, hookName }`)
- Files: recover-orphaned-tasks.ts, run-hook.ts, run-chain-hook.ts, plugin-loader/index.ts
- Last observed: 2026-03-17

## Rationale
Structured logging with context objects enables filtering and correlation in log aggregation systems, making it easier to trace issues across a distributed system.
