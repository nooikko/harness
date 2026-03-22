---
id: integration-test-fire-and-forget-assertions
trigger: when writing or debugging integration tests with fire-and-forget plugin hooks (identity scoreAndWriteMemory, summarization, cron hot-reload, auto-namer)
confidence: 0.75
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Integration Test Assertions with Fire-and-Forget Hooks

## Action
Never assert exact invoke call counts in multi-plugin integration tests; use defensive assertions that account for background hook calls, verify side effects independently, and guard ordering assumptions with structural checks.

## Evidence
- Observed 4+ times in session 089f503a-9242-463c-8b01-4fa9cbe0f7dd (2026-03-14)
- full-pipeline test: expected `toHaveBeenCalledTimes(1)` fails with "got 2 times" (identity's scoreAndWriteMemory fires after invoke returns)
- identity test: reads `calls[0]` as pipeline call without structural guard; works today because scoreAndWriteMemory is `void`, but would silently break if awaited upstream
- cron test: asserts DB record fields (prompt, schedule, enabled) but skips `nextRunAt` which is computed by fire-and-forget cron hot-reload hook
- delegation test: asserts notification count without verifying loop didn't retry (if invoker mocks retry, test silently passes with extra calls)

## Patterns to Recognize
1. **Call count assertions fail**: Fire-and-forget hooks (void) start after pipeline returns → additional mock calls registered
2. **Timing assumptions without guards**: `calls[0]` indexing works because void methods start async, but has no structural protection against refactoring
3. **Missing side-effect assertions**: Hot-reload hooks compute derived fields (nextRunAt, etc.); DB checks must verify output of hook, not just input to tool

## Solution
```typescript
// BAD: exact invoke count
expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);

// GOOD: call was made, then inspect the first call (pipeline is always calls[0])
expect(harness.invoker.invoke).toHaveBeenCalled();
const pipelinePrompt = harness.invoker.invoke.mock.calls[0]![0] as string;

// GOOD: assert side effects independently
const job = await prisma.cronJob.findFirst(...);
expect(job?.nextRunAt).not.toBeNull();  // hot-reload computed this

// GOOD: guard ordering assumptions with content check
const soulPos = prompt.indexOf('soul marker');
expect(soulPos).toBeGreaterThan(0);  // proves soul is in prompt
```

Last observed: 2026-03-14 (full test run with cron/identity/delegation/full-pipeline integration tests failing)
