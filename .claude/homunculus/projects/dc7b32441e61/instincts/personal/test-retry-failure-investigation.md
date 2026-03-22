---
id: test-retry-failure-investigation
trigger: when running tests that fail, especially after refactoring components or tests
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test Retry for Failure Investigation

## Action
When tests fail after code changes, run the same test command multiple times in quick succession (within minutes) to gather diagnostic information and understand failure patterns before modifying code.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051 (2026-03-16T00:31:10-00:31:44)
- Pattern: Failed test from test refactoring was retried without intermediate code changes
  - 00:31:10 — `vitest run` → "1 failed | 170 passed"
  - 00:31:25 — `vitest run` → "1 failed | 170 passed" (identical counts)
  - 00:31:44 — `vitest run` with detailed error output showing "does not render project groups in sidebar"
- Context: Test assertion changed from mock-dependent check to generic assertion during component refactoring (removed NavProjects feature)
- Last observed: 2026-03-16T00:31:44Z

## Why This Matters
Retrying tests without code changes can reveal whether failure is deterministic (always same) or flaky. When a test fails immediately after refactoring, the first rerun validates the failure is consistent before investigating the assertion logic.
