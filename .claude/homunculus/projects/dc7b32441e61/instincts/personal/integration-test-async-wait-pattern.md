---
id: integration-test-async-wait-pattern
trigger: when writing integration tests that verify async DB state changes or background task execution
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Use vi.waitFor Instead of setTimeout for Async Integration Test Assertions

## Action
Use `await vi.waitFor(async () => { ... }, { timeout: 10_000 })` to verify DB state after async operations in integration tests, never raw setTimeout.

## Evidence
- Observed 4+ times across cron-plugin and delegation-plugin integration tests
- Pattern: Tests that create jobs/tasks, then poll DB to verify state changes
- All examples use interval-based polling with timeout safety
- Tests include: cron job firing, thread creation, task persistence, delegation state updates
- Last observed: 2026-03-14T03:52 session

## Rationale
- vi.waitFor prevents race conditions by polling until assertion succeeds
- Explicit timeout prevents hanging tests
- More robust than timing-based assertions
- Matches vitest best practices for async test patterns

## Related Instincts
- integration-test-database-reset
- integration-test-orchestrator-factory
- vitest-mock-setup-pattern
