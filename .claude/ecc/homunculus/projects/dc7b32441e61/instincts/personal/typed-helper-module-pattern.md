---
id: typed-helper-module-pattern
trigger: when creating utility modules in src/_helpers/
confidence: 0.85
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Typed Helper Module Pattern

## Action
Create focused utility modules in src/_helpers/ with strong type definitions for all exports and JSDoc comments explaining purpose.

## Evidence
- Observed 12 instances across multiple sessions (2026-03-15 and 2026-03-16)
- Session 2026-03-15: 5 consecutive embedding/collections helpers (embedder, collections, ensure-collections, upsert-point, search-points)
- Session 2026-03-16: 7 calendar/outlook API integration helpers (graph-fetch, list-events, get-event, create-event, update-event, delete-event, outlook/index)
- Pattern: Each file exports one primary function with matching type definition (e.g., `GraphFetch` type + `graphFetch` function)
- Structure consistency: Type definitions precede exports; async handlers with proper error handling
- Domain-focused: Each module handles single responsibility (API fetching, event listing/creation/updates, email operations)
