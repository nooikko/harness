# Validator Plugin — Developer Notes

## Overview

Single-hook plugin. Implements `onTaskComplete`. Read `src/index.ts`, `src/_helpers/build-rubric-prompt.ts`, and `src/_helpers/parse-verdict.ts` before editing.

---

## Safety valve — always accept the last iteration

```typescript
if (!task || task.currentIteration >= task.maxIterations) {
  return;
}
```

This guard is critical. Without it, a strict validator on the last iteration would throw, the delegation loop would have no iterations left to retry, and it would enter an error state rather than returning the best available result. Do not remove or weaken this check.

---

## Verdict parsing

`parseVerdict` reads the Opus output and extracts a structured verdict. The expected output format is defined by the rubric prompt in `build-rubric-prompt.ts`. If Opus returns something unparseable, the validator auto-accepts with a `warn` log:

```typescript
ctx.logger.warn('Validator: could not parse verdict, auto-accepting', { taskId, threadId });
```

If you're seeing unexpected auto-accepts, check whether the rubric prompt is eliciting the expected output structure, or whether `parseVerdict` is handling all expected Opus response variations.

---

## Failure mechanism

The validator throws on `fail` verdict:
```typescript
throw new Error(feedback);
```

The delegation plugin catches this throw in its `onTaskComplete` handler and uses the error message as feedback for the next retry. The feedback text becomes part of the re-delegation prompt. Keep rubric instructions focused on actionable feedback — vague failure messages produce vague retries.

---

## Model choice

`ctx.invoker.invoke(rubricPrompt, { model: 'claude-opus-4-6' })` — Opus is used intentionally. Validation requires careful judgment, not speed. Using Haiku or Sonnet here would reduce cost but also reduce the quality of the quality gate, which defeats the purpose.

The validator invoke is blocking (not fire-and-forget). This is correct — the delegation loop must wait for the verdict before deciding whether to accept or retry.

---

## The `threadId` in invoke options

```typescript
ctx.invoker.invoke(rubricPrompt, { model: 'claude-opus-4-6', threadId });
```

Passing `threadId` routes the validator invocation through the parent thread's session context. This is intentional — the validator can see the same context the main thread has. Do not remove this unless you have a specific reason to isolate the validator.

---

## Interaction with delegation

The validator and delegation plugins are coupled through `onTaskComplete`. If you modify the task schema (e.g., rename `currentIteration` or `maxIterations`), update both plugins. The delegation plugin creates and manages tasks; the validator reads them.
