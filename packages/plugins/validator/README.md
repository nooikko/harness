# Validator Plugin

## What it does

The validator plugin quality-gates sub-agent outputs in the delegation loop. When a delegated task completes, the validator uses Claude Opus to evaluate the result against the original task prompt using a structured rubric. If the output fails, it throws an error — causing the delegation loop to retry with the failure feedback. If it passes, the task is accepted.

## Why it exists

Delegation without validation is just hoping. A sub-agent that returns a plausible-looking but wrong answer would be silently accepted. The validator adds an independent review step so the delegation system can self-correct before returning results to the parent thread.

## How it works

- Hook: `onTaskComplete` — fires inside the delegation loop after each task iteration
- Loads the task record to get the original prompt and current iteration count
- Skips validation on the final allowed iteration (safety valve — prevents infinite loops)
- Invokes Claude Opus with a rubric prompt that scores the output
- Parses the verdict: `pass` accepts the result, `fail` throws with feedback, unparseable verdicts auto-accept with a warning

## What happens on failure

When the validator throws, the delegation plugin catches it and treats the iteration as failed. It records the feedback, increments the iteration counter, and retries the task with the original prompt plus the validator's feedback appended. This continues until either the validator accepts or `maxIterations` is reached.

## What it does not do

The validator does not modify the output. It only accepts or rejects. If you need to transform or enrich outputs, that belongs in a different plugin or in the delegation loop itself.

The validator does not run on the final iteration — the last attempt is always accepted regardless of quality. This is intentional: better to return a partial answer than to silently discard all results.
