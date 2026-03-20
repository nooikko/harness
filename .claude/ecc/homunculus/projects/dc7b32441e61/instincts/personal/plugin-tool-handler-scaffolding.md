---
id: plugin-tool-handler-scaffolding
trigger: when creating new plugin tool handler files
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Tool Handler Scaffolding Pattern

## Action
Structure all new plugin tool handlers following: input validation → existence checks → business logic → error handling → database operations → success message.

## Evidence
- Observed 4 times in sessions 2026-03-15
- Pattern: add-dependency.ts, update-task.ts, complete-task.ts, remove-dependency.ts all follow the same scaffolding structure
- Each file: (1) Extracts input with `as` type cast, (2) Validates required fields, (3) Queries DB for state, (4) Applies constraints/logic, (5) Returns error strings on failure, (6) Returns success message with data on success
- Last observed: 2026-03-15T06:16:20Z

## Rationale
Plugin tool handlers in this project consistently use a defensive input-validation-first approach with string-based error returns. Following this pattern ensures consistency in error handling and makes handlers predictable for downstream consumers.
