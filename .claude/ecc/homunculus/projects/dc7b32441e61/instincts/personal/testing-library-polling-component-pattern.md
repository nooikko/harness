---
id: testing-library-polling-component-pattern
trigger: when writing @testing-library/react tests for components with async polling or delayed state updates
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Use waitFor with Fake Timers for Component Polling Tests

## Action
When testing async polling behavior in React components with Testing Library, import `waitFor` from `@testing-library/react` and pair it with `vi.useFakeTimers()` and `vi.advanceTimersByTimeAsync()` to control async timing and verify state transitions.

## Evidence
- Observed 4 times in session 4856ee0a-a85e-44ce-988d-133f25f77051 (2026-03-16)
- Pattern: Write component test for polling behavior → Run tests → Failures on assertions that expect state not yet rendered → Add waitFor import → Modify test to advance fake timers → Tests pass
- Examples: youtube-account-section.test.tsx (OAuth polling), cast-device-list.test.tsx (device fetching with delays)
- Tests involve: initiating async operations, advancing timers by intervals (3100ms for 3s+ polls), asserting on resulting state changes
- Last observed: 2026-03-16T21:35:34Z

## Rationale
- `vi.useFakeTimers()` lets you control polling intervals deterministically without real delays
- `vi.advanceTimersByTimeAsync()` advances timers and allows Promises to resolve
- `waitFor` from Testing Library waits for assertions to pass (though less critical with fake timers)
- This pattern prevents flaky tests and avoids actual 3+ second waits during test runs

## Pattern Details
1. Set up fake timers in `beforeEach`: `vi.useFakeTimers({ shouldAdvanceTime: true })`
2. Restore in `afterEach`: `vi.useRealTimers()`
3. In test: create mock functions, trigger async operation, advance timers, assert on updated state
4. User must import `waitFor` from '@testing-library/react' if assertions don't find elements after timer advance

## Related Instincts
- integration-test-async-wait-pattern (uses vi.waitFor instead for integration tests)
