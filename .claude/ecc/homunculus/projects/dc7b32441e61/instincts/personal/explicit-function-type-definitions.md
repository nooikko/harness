---
id: explicit-function-type-definitions
trigger: when exporting helper functions from TypeScript modules
confidence: 0.85
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Explicit Function Type Definitions

## Action
Define a type alias for the exported function's signature before implementing the function itself.

## Evidence
- Observed 10+ times across helper files in session 31c444d9-8205-4bd5-af0b-09f5495a3367
- Pattern: Every exported helper function starts with a type definition (e.g., `type RecoverOrphanedTasks = (db: PrismaClient, logger: Logger) => Promise<number>`)
- Files: recover-orphaned-tasks.ts, run-hook.ts, run-chain-hook.ts, create-scoped-db.ts, categorize-failure.ts, calculate-backoff-ms.ts, map-stream-event.ts, plugin-loader/index.ts, build-iteration-prompt.ts, load-agent-config.ts
- Last observed: 2026-03-17

## Rationale
Defining the type alias first clarifies the function's contract before implementation and makes the signature explicit at module scope (discoverable without reading implementation details).
