---
id: plugin-exploration-workflow
trigger: when exploring a new plugin or plugin system implementation
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Exploration Workflow

## Action
Follow a three-step exploration pattern when learning how plugins work: read the index to understand tool definitions, glob for helper files to discover structure, then read specific implementations to understand patterns.

## Evidence
- Observed 3+ times across calendar and outlook plugin exploration (session bbe56a1c)
- Pattern: index.ts read → Glob _helpers → Read specific handlers (create-event.ts, update-event.ts, read-email.ts, move-email.ts, reply-email.ts, graph-fetch.ts)
- Consistent structure across both plugins: plugin definitions in index, reusable utilities in graph-fetch, specific action handlers in separate files
- Last observed: 2026-03-16

## Notes
- This workflow efficiently discovers how plugins are structured before diving into implementation details
- Glob pattern `packages/plugins/*/src/_helpers/*` effectively discovers all available helpers
- Look for shared utilities like graph-fetch.ts that are reused across plugins
