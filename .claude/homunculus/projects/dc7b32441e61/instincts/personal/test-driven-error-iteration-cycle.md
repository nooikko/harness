---
id: test-driven-error-iteration-cycle
trigger: when test failures occur and code is being debugged
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test-Driven Error Investigation and Iteration Cycle

## Action
When tests fail during development, use the error output to guide edits: run tests → read failure details → edit code/test expectations → run tests again to verify fix.

## Evidence
- Observed 4+ times in sessions d9308cae-3256-4a0e-8a62-2801f19887d6 and ba6e2533-1faa-4752-9d78-561342f98530
- Timestamps: 2026-03-18T02:29:37Z through 02:29:54Z
- Cycle sequence:
  1. Bash test run shows `toHaveLength(4)` failure in `cron-job-definitions.test.ts` (02:29:37Z)
  2. Edit adds `traceId` to test expectation in `activity/src/__tests__/index.test.ts` (02:29:38Z)
  3. Bash test run again, error changes to `Cannot read properties of undefined (reading 'traceId')` (02:29:43Z)
  4. Bash shows more tests passing after code adjustments (02:29:54Z)
- Pattern: Each test failure points to the next required edit, creating iterative progress

## Why This Matters
Running tests frequently after small edits keeps the debugging loop tight and visible. Error messages guide the next fix rather than guessing what to change next.
