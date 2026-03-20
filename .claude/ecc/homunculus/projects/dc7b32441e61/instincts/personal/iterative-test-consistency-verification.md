---
id: iterative-test-consistency-verification
trigger: when implementing features or debugging code changes
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Iterative Test Consistency Verification

## Action
Run the test suite multiple times in quick succession to verify test consistency and detect flakiness before proceeding to other checks.

## Evidence
- Observed 3 identical vitest runs in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Run 1: 2026-03-15T23:17:20Z - 168 test files passed, 1216 tests
- Run 2: 2026-03-15T23:17:49Z - Same result (168 files, 1216 tests)
- Run 3: 2026-03-15T23:18:51Z - Same result (168 files, 1216 tests)
- Pattern: All three runs show identical passing output, confirming no flakiness or regression
- Gap between runs: ~29s each, suggesting manual re-invocation

## Rationale
Repeating tests ensures the test suite is stable and not introducing false positives due to timing issues or flaky tests. This validates that code changes don't introduce intermittent failures.
