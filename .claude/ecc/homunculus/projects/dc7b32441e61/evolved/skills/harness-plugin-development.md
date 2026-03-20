---
name: harness-plugin-development
description: Auto-triggered patterns for developing harness plugins — scaffolding, hook implementation, tool handlers, error isolation, and state management
evolved_from:
  - plugin-context-mock-factory
  - plugin-crud-agent-scope-isolation
  - plugin-crud-test-scope-verification
  - plugin-chain-hook-prompt-transformation
  - plugin-entry-then-helpers-exploration
  - plugin-handler-type-safe-input-validation
  - plugin-helper-ecosystem-review
  - plugin-hook-error-isolation
  - plugin-module-level-lifecycle-state
  - plugin-registration-order-determines-hook-precedence
  - plugin-settings-reload-hook
  - plugin-tool-handler-scaffolding
  - plugin-vitest-minimal-config
  - broadcast-async-plugin-events
  - fire-and-forget-plugin-background-tasks
---

# Harness Plugin Development

Auto-triggered skill for writing plugins in the harness orchestrator.

## When to Activate

Any time code is being written or modified in `packages/plugins/*/`.

## Patterns

### Structure
- Entry point: `src/index.ts` exports `PluginDefinition`
- Helpers: `src/_helpers/<kebab-case>.ts` — one export per file
- Tests: `src/_helpers/__tests__/<helper>.test.ts`
- Config: `vitest.config.ts` with minimal setup (workspace root reference)

### Tool Handlers
- Extract input with type-safe validation: `const { field } = input as { field: string }`
- Resolve `agentId`/`projectId` from `meta.threadId` via DB lookup
- Return string results (MCP protocol)
- Guard against missing/invalid input with early returns

### Hook Implementation
- `onBeforeInvoke` is a chain hook — receive prompt, return modified prompt
- `onAfterInvoke`, `onMessage`, `onBroadcast` are notify hooks — no return value
- Background work uses fire-and-forget: `void (async () => { ... })()`
- Wrap hook bodies in try/catch — errors are isolated per plugin

### State Management
- Module-level variables for lifecycle state (e.g., `let server: CronServer | null`)
- `start()` initializes, `stop()` cleans up
- `onSettingsChange` triggers reload (stop + start pattern)

### Plugin Context Mocking (Tests)
- Create factory: `const mockCtx = { db: mockDb, logger: mockLogger, ... }`
- Mock `ctx.db` with vi.fn() returning prisma-shaped results
- Mock `ctx.invoker.invoke` for LLM calls
- Mock `ctx.sendToThread` and `ctx.broadcast` for pipeline triggers

### Registration Order
- Identity MUST be first (soul injection before context)
- New plugins go after `projectPlugin` unless hook ordering matters
- Add to `ALL_PLUGINS` in `apps/orchestrator/src/plugin-registry/index.ts`
- Add workspace dependency to `apps/orchestrator/package.json`

### Agent Scope Isolation
- CRUD handlers that touch agent-owned data must filter by `agentId`
- Resolve agent from thread: `thread.agentId`
- Tests verify scope isolation: task created by agent A not visible to agent B
