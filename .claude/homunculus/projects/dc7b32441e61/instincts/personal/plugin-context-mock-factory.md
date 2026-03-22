---
id: plugin-context-mock-factory
trigger: when writing vitest tests for PluginContext-consuming functions
confidence: 0.85
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# PluginContext Mock Factory with Override Pattern

## Action
Create a reusable mock context factory function with a generic `CreateMockContext` type that accepts optional `overrides` parameter, providing complete PluginContext mocks with vi.fn() that tests can selectively override for different scenarios.

## Evidence
- Observed 9+ times across two sessions
- Session 2464ac8f-58a5-496a-b12e-600dcb754571 (2026-03-14): list-cron-jobs.test.ts, get-cron-job.test.ts, update-cron-job.test.ts, delete-cron-job.test.ts
- Session 4856ee0a-a85e-44ce-988d-133f25f77051 (2026-03-16): settings-schema.test.ts, youtube-music-auth.test.ts, device-alias-manager.test.ts, oauth-routes.test.ts, device-routes.test.ts (all music plugin helpers)
- Pattern: `const createMockCtx = () => ({ db: { pluginConfig: { ... } }, notifySettingsChange: vi.fn(), logger: { ... } }) as unknown as PluginContext`
- All use `vi.fn().mockResolvedValue()` or `vi.fn().mockReturnValue()` for mock methods
- Last observed: 2026-03-16T21:06:14Z

## Why This Pattern
- Eliminates mock boilerplate duplication across test files
- Single source of truth for default mocks
- Allows fine-grained override for edge cases without rebuilding entire context
- Type-safe with generic `CreateMockContext` type
- `as never` cast suppresses type errors for partial mocks
