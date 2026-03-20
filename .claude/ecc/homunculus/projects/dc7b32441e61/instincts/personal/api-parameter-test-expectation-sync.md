---
id: api-parameter-test-expectation-sync
trigger: when a mocked API function signature is expanded with new parameters
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# API Parameter Addition Test Expectation Synchronization

## Action
When adding a new parameter to a mocked function's signature, systematically update ALL test expectations that call that function to include the new parameter in the expectation matcher.

## Evidence
- Observed 9+ times in session 31c444d9 (2026-03-17, timestamps 18:43:23 - 18:46:03)
- Change: `invoker.invoke()` signature expanded to include `taskId` parameter
- Edits to multiple test files:
  1. `/packages/plugins/delegation/src/_helpers/__tests__/invoke-sub-agent.test.ts` (4 test expectations updated)
  2. `/packages/plugins/delegation/src/_helpers/__tests__/delegation-loop.test.ts` (3 test expectations updated)
- Pattern: Grep for parameter references → Read affected test file → Edit all expectation matchers → Verify with test run
- Spanning two orchestrator test runs (18:45:44Z and 18:46:00Z) with failure investigation
- Last observed: 2026-03-17T18:46:03Z

## Why This Matters
Missing a test expectation update when a function signature changes allows the test to silently ignore the new parameter, potentially hiding bugs. Using TypeScript/test runner output to find ALL affected expectations ensures comprehensive coverage of API changes.

## Related Instinct
See also `prop-type-test-fixture-sync.md` for similar pattern with component props.
