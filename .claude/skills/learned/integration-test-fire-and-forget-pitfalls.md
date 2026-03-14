---
name: integration-test-fire-and-forget-pitfalls
description: "Avoid exact invoke counts in integration tests; fire-and-forget hooks add extra calls"
user-invocable: false
origin: auto-extracted
---

# Integration Test Pitfalls: Fire-and-Forget Hooks

**Extracted:** 2026-03-13
**Context:** Writing integration tests for the Harness plugin system

## Problem
Integration tests that assert `expect(invoker.invoke).toHaveBeenCalledTimes(1)` fail because
fire-and-forget plugin hooks (identity's `scoreAndWriteMemory`, summarization, auto-namer) make
additional `invoker.invoke()` calls in the background after the pipeline invoke returns.

When using `sendToThread` (the production path), the full hook chain fires — including `onAfterInvoke`
hooks that spawn background Haiku calls for memory scoring, summarization, etc. These register as
additional invoke calls on the shared mock.

## Solution
Never assert exact invoke call counts in multi-plugin integration tests. Instead:

```typescript
// BAD — breaks when fire-and-forget hooks add calls
expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);

// GOOD — assert it was called, then inspect calls[0] for the pipeline call
expect(harness.invoker.invoke).toHaveBeenCalled();
const prompt = harness.invoker.invoke.mock.calls[0]![0] as string;

// GOOD — for concurrent tests, assert minimum calls
expect(harness.invoker.invoke.mock.calls.length).toBeGreaterThanOrEqual(2);
```

The pipeline call is always `calls[0]` because `scoreAndWriteMemory` is fire-and-forget (`void`)
and starts after the synchronous pipeline invoke returns.

## Also: onBeforeInvoke Chain Ordering

The context plugin PREPENDS its output (history, files, project context) before the prompt it
receives from the identity plugin. So the actual prompt order is:

```
[context: project instructions + history + files]
[identity: soul header]
[user message]
[identity: behavioral anchor]
```

History appears BEFORE the soul header in the final prompt — this is correct production behavior.

## When to Use
- Writing any integration test that uses `sendToThread` with identity, summarization, or auto-namer plugins
- Writing multi-plugin integration tests (full-pipeline)
- Asserting prompt structure or invoke counts in integration tests
