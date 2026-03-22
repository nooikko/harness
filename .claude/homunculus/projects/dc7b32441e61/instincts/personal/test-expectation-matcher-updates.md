---
id: test-expectation-matcher-updates
trigger: when test expectations need updates due to function signature changes in mocked functions
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test Expectation Matcher Updates

## Action
When function signatures change and existing parameters become less important or variable in tests, replace specific parameter expectations with matchers (e.g., `expect.anything()`) rather than exact value assertions to reduce test brittleness.

## Evidence
- Observed 5+ times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: `deps.logger` → `expect.anything()` in expect() calls
- Pattern: Logger parameter assertions replaced with matchers when focus shifts to other parameters
- Files affected: orchestrator test suite (index.test.ts, health-check test suite)
- Last observed: 2026-03-17T01:42:09Z

## Context
During refactoring of hook call signatures to include plugin names parameter, test expectations were updated. Rather than updating logger parameter assertions, they were changed to use matchers, allowing tests to focus on the new plugin names parameter (array argument) without coupling to logger instance equality.
