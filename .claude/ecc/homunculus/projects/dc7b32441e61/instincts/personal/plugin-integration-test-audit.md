---
id: plugin-integration-test-audit
trigger: when auditing which plugins have integration test coverage
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Integration Test Coverage Audit Workflow

## Action
When auditing which plugins are covered by integration tests, use Agent to explore plugin structures across multiple plugins, then systematically Read each plugin's test file at `packages/plugins/{name}/src/__tests__/index.test.ts` and compare against test helpers in `tests/integration/helpers/create-harness.ts`.

## Evidence
- Observed 4+ times in session 31a3b08a-b68a-4c42-8daf-343f83a59fb7
- Pattern: Agent exploration of calendar, music, outlook, search plugins followed by targeted Read operations on each plugin's test file
- Last observed: 2026-03-17 16:13:58Z
- Integration helpers consistently referenced when examining plugin tests (createTestHarness, createMultiPluginHarness)

## Implementation Details
- All plugins store tests at `packages/plugins/{name}/src/__tests__/index.test.ts`
- Integration test helper utilities in `tests/integration/helpers/` support both single and multi-plugin harnesses
- Plugin implementations use `_helpers/` subdirectory for internal utilities
- Test coverage follows consistent patterns across plugin types (tool-only vs. stateful vs. hook-based)
