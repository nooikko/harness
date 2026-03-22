---
id: integration-test-orchestrator-factory
trigger: when setting up integration tests for a plugin
confidence: 0.85
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Integration Test Orchestrator Factory Pattern

## Action
Use `createTestHarness(plugin, opts?)` factory to bootstrap orchestrator + database for integration tests. Factory returns `{ orchestrator, prisma, invoker.invoke, threadId, cleanup }`. Store result in `harness` variable throughout test.

## Evidence
- Observed 4+ times in integration test files
- Pattern: `harness = await createTestHarness(plugin, { invokerOutput?, invokerModel?, invokerTokens?, port? })`
- Applied in: identity-plugin.test.ts, delegation-plugin.test.ts, cron-plugin.test.ts, web-plugin.test.ts
- Factory handles: orchestrator registration, plugin start, thread creation, mock invoker setup
- Optional port parameter for web plugin tests
- Last observed: 2026-03-14

## Why
Centralizes setup logic so each test doesn't need to manually construct orchestrator, connect Prisma, create threads, and mock the invoker. Reduces test boilerplate and ensures consistent test environment.
