---
id: plugin-test-mocking-convention
trigger: when writing tests for plugin tool handlers
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Test Mocking Convention with vi.fn()

## Action
Use a factory function `createMockContext` that returns a fully mocked `PluginContext` with `vi.fn()` for all `ctx.db.*` operations; ensure error handling paths are tested (unhandled Prisma errors, missing records, constraint violations).

## Evidence
- Observed 6 times across test files in session 4cb4a5e3-7c78-4cbb-a77a-18a7f444790b
- Pattern: All plugin test files (add-task, update-task, complete-task, add-dependency, remove-dependency, list-tasks) follow identical mock structure
- Factory function creates context with `vi.fn().mockResolvedValue()` for DB operations
- Tests mock both success and error paths (findUnique returning null, update throwing)
- Last observed: 2026-03-18

## Notes
- Consistent naming: `createMockContext`, `MockDb` type, `defaultMeta` const
- Each test file independently creates full mocks rather than sharing a helper
- Consider extracting to a shared `__tests__/mock-context.ts` to reduce duplication
- Current tests often lack coverage for Prisma error cases (P2025, P2003) — should add mockRejectedValue tests
