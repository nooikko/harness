---
name: harness-integration-testing
description: Auto-triggered patterns for writing integration tests against the harness plugin/orchestrator system
evolved_from:
  - integration-test-async-wait-pattern
  - integration-test-database-reset
  - integration-test-documentation-inventory
  - integration-test-fire-and-forget-assertions
  - integration-test-orchestrator-factory
  - multi-plugin-integration-test-gap
  - plugin-integration-test-structure-exploration
  - plugin-context-mock-factory
---

# Harness Integration Testing

Auto-triggered when writing integration tests in `**/__tests__/*.integration.test.ts`.

## Patterns

### Database Reset
- Use `beforeEach` with `prisma.$executeRawUnsafe('TRUNCATE ... CASCADE')`
- Reset all tables touched by the test, not just the primary one
- Testcontainers for PostgreSQL (see `pnpm test:integration`)

### Orchestrator Factory
- Build a minimal orchestrator with only the plugins under test
- Use real `PluginContext` construction, not mocks
- Wire `sendToThread` to capture output instead of calling Claude

### Fire-and-Forget Assertions
- Plugins like identity, summarization, auto-namer use `void (async () => { ... })()`
- Cannot assert immediately — use `vi.waitFor()` or poll with timeout
- Pattern: `await vi.waitFor(() => expect(mockDb.agentMemory.create).toHaveBeenCalled(), { timeout: 2000 })`

### Async Wait Pattern
- DB writes from background tasks need settling time
- Use `await new Promise(r => setTimeout(r, 100))` before assertions on background effects
- Prefer `vi.waitFor` over fixed timeouts when possible

### Multi-Plugin Integration
- Test plugin interactions (e.g., identity + context prompt chain)
- Register plugins in correct order — hook precedence matters
- Verify the combined prompt output, not individual plugin contributions

### Coverage Gaps to Watch
- Cross-plugin hook interactions (onBeforeInvoke chain with 3+ plugins)
- Error isolation (plugin A throws, plugin B still fires)
- Settings reload cascades (onSettingsChange triggers stop+start)
