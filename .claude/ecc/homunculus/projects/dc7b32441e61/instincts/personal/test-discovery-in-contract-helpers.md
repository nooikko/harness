---
id: test-discovery-in-contract-helpers
trigger: when analyzing plugin contract helper modules and utilities
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test Discovery in Contract Helpers

## Action
After reading plugin contract helper modules to understand utility patterns (hooks, error handling, chain logic), use Glob to search for and examine existing test files in the `__tests__/` directory to understand testing conventions and verify test coverage.

## Evidence
- Observed 4 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Glob searches for `*.test.ts` files after reading helper implementations
- Files discovered: `run-hook.test.ts`, `run-chain-hook.test.ts`, and related utility tests
- All searches in `packages/plugin-contract/src/_helpers/__tests__/`
- Occurs during context gathering before implementing contract-related changes
- Last observed: 2026-03-17T01:36:06Z

## Why
Plugin contract helpers are foundational utilities used across all plugins. Before implementing changes or adding new utilities, examining existing tests reveals:
- Testing patterns and conventions for hook runners
- Mock strategies for Logger dependencies
- Edge cases already covered (error isolation, async handling, value chaining)
- Expected behavior for error propagation

This prevents reimplementing utilities incorrectly and ensures consistency with the contract framework.
