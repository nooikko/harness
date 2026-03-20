---
id: retry-stale-session-on-invoke
trigger: when session.send() returns "Session is closed" error in invoker catch block
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Retry Stale Session on Invoke Error

## Action
When SDK invoker receives "Session is closed" error (exact string match), evict the stale session, obtain a fresh session from the pool, and retry the send operation once. Only retry on this exact error message; use different branches for other errors and similar messages like "Session closed".

## Evidence
- Observed 5 times in session 31c444d9-8205-4bd5-af0b-09f5495a3367
- Pattern: Defensive retry guard added to `apps/orchestrator/src/invoker-sdk/index.ts` catch block (lines ~86-99) to mitigate TOCTOU race between eviction timer and send() invocation
- Fixes H3 from agent-stability-audit: "Session pool eviction race (TOCTOU)"
- Test coverage: 4 test cases in `__tests__/index.test.ts` validate:
  1. Retry succeeds with fresh session
  2. Retry fails and returns error
  3. Non-"Session is closed" errors bypass retry
  4. "Session closed" (without "is") does not trigger retry (intentional close distinction)
- Last observed: 2026-03-17T23:42:52Z

## Notes
- Use `err instanceof Error && err.message === 'Session is closed'` for exact match
- Call `pool.evict(poolKey)` before retry
- Reuse same sendOptions and timeout for retry
- Set exitCode to 1 on retry failure
