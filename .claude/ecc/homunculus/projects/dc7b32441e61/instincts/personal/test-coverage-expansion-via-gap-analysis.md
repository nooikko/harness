---
id: test-coverage-expansion-via-gap-analysis
trigger: when test coverage is below target and needs systematic improvement
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test Coverage Expansion via Gap Analysis

## Action
When expanding test coverage below 80%+, systematically identify coverage gaps (missing branch paths), add focused tests using vi.fn() mocking where needed for isolation, test multiple parameter combinations and edge cases, then validate with repeated test runs.

## Evidence
- Observed 4 times in session 4856ee0a-a85e-44ce-988d-133f25f77051 (2026-03-16)
- Pattern 1: Agent improved error-filters.test.tsx (4→12 tests) and error-list.test.tsx (4→18 tests) by identifying untested branches and adding focused tests with mocking
- Pattern 2: Manual expansion of index.test.ts added warn/debug level tests, _pinoInstance property check, and test coverage for fallback behavior with vi.fn() mocks
- Pattern 3: env.test.ts created with systematic environment variable testing using vi.stubEnv() isolation pattern
- Pattern 4: Iterative test validation with multiple vitest runs (4+ instances) to check results
- Last observed: 2026-03-16T02:16:27Z

## Pattern Details
1. **Gap Identification**: Read both source and test files to understand what branches/paths lack coverage
2. **Focused Test Addition**: Add specific tests for each missing branch, not generic test suites
3. **Mocking Strategy**: Use vi.fn() for function mocks, vi.stubEnv() for env vars, vi.resetModules() between tests to maintain isolation
4. **Parameter Coverage**: Test multiple parameter combinations (metadata with/without, null states, edge values)
5. **Iterative Validation**: Run tests frequently during expansion to catch regressions early
6. **Target Verification**: Run test suite multiple times to ensure consistent passes before completion

This prevents coverage gaps that hide until production and ensures branch/path coverage remains high across component expansion.
