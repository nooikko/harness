---
id: vitest-mock-setup-pattern
trigger: when writing vitest unit tests with mocked modules
confidence: 0.85
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Vitest Mock Setup Pattern

## Action
Declare mock functions at module level with vi.fn(), use vi.mock() to replace module imports, set default mock return values in beforeEach hook, and always call vi.clearAllMocks() in beforeEach.

## Evidence
- Observed 11+ times across test files in March 2026
- Pattern consistently applied in component tests: update-project.test.ts, agent-card.test.tsx, update-thread-project.test.ts, project-card.test.tsx, send-thread-notification.test.ts, setup-delegation-task.test.ts
- Pattern reinforced in plugin helper tests (session 4856ee0a-a85e-44ce-988d-133f25f77051): settings-schema.test.ts, youtube-music-auth.test.ts, device-alias-manager.test.ts, oauth-routes.test.ts, device-routes.test.ts
- Structure: mock declaration → vi.mock() → afterEach with vi.clearAllMocks() and mockResolvedValue setup
- afterEach cleanup pattern consistent (cleanup() for React components, vi.clearAllMocks() for functions)
- Last observed: 2026-03-16T21:06:14Z
