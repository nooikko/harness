---
id: non-atomic-multi-step-db-operations
trigger: when performing multiple separate ctx.db calls (read then write, or create then createMany)
confidence: 0.85
domain: debugging
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Non-Atomic Multi-Step Database Operations

## Action
Wrap multi-step DB operations (findUnique+update, create+createMany) in a `$transaction` block to prevent race conditions and silent data loss.

## Evidence
- Observed 5+ times in sessions 980fccb2-ec01-48f5-b2ba-aa84b2c61eb3 and 4cb4a5e3-7c78-4cbb-a77a-18a7f444790b
- Pattern: Two or more separate `await ctx.db.*` calls where the second call depends on the first, with no transaction wrapper
- `project` plugin: concurrent `set_project_memory` calls both read `thread.projectId`, both write full memory doc → last write silently discards first
- `tasks` plugin `complete-task`: findUnique checks status, then update marks DONE → P2025 if deleted between steps
- `tasks` plugin `add-task`: creates task, then createMany for dependencies → P2003 if FK invalid, task persists as ghost
- `tasks` plugin `add-dependency`: BFS traversal reads graph in multiple queries, then create → concurrent calls bypass cycle check
- Last observed: 2026-03-18

## Notes
- Prisma `$transaction` for interactive transactions: `await ctx.db.$transaction(async (tx) => { ... })`
- Activity plugin uses this pattern correctly with `$transaction(async (tx) => ...)`
- Without transactions: concurrent tool calls or UI actions can cause data loss or constraint violations
