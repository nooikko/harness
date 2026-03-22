---
id: feature-implementation-schema-infrastructure-reading
trigger: when starting to implement a new feature involving database models or plugin integration
confidence: 0.75
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Feature Implementation Schema + Infrastructure Reading

## Action
When beginning feature implementation, systematically read the database schema (in sections) and plugin infrastructure files (registry, plugin entry points, configuration) to understand architectural constraints before coding.

## Evidence
- Observed 8+ Read operations on database schema across different line ranges (1-50, 46-95, 200-356) in session bbe56a1c
- Read plugin structure files sequentially: index.ts → package.json → tsconfig → vitest for project plugin
- Read plugin registry and orchestrator package.json for integration context
- Pattern: Schema → Plugin structure → Registry → Schema again (cross-referencing)
- Followed by TodoWrite with 6-step implementation plan (confirms planning phase)
- **Recurring pattern confirmed**: Session 361dcce6 (2026-03-17T15:50:06Z onwards) shows identical workflow:
  - 7+ Read operations: project/package.json, tsconfig.json, plugin index.ts, workspace.yaml, plugin-registry, orchestrator package.json, vitest.config.ts
  - Preceded by Agent exploration and TodoWrite for 9-step browser plugin implementation plan
  - Same read sequence ordering pattern (entry point → config → test setup)
- Last observed: 2026-03-17T15:50:12Z

## Why This Works
The harness codebase uses Prisma models with relationships and plugin architecture. Reading schema in multiple passes catches edge cases about relationships and constraints. Reading plugin infrastructure (registry, entry points, configs) prevents architectural mismatches in how new features integrate.

## Related Instincts
- plugin-entry-then-helpers-exploration: plugin internal structure understanding
- schema-model-inspection-ui-planning: schema inspection for feature design
- research-driven-codebase-exploration: general Glob + Read exploration pattern
