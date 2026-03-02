# Delegation Plugin — Implementation Notes for Claude Code

Read this before editing any file in `packages/plugins/delegation/`.

## Delegation is triggered ONLY via the MCP tool

Delegation is triggered exclusively when Claude calls the `delegation__delegate` MCP tool during an invocation. There is no `/delegate` text command path — that was removed in Sprint 3.

The tool handler in `src/index.ts` calls `runDelegationLoop` directly, without awaiting it. The loop runs entirely in the background. The tool handler returns the string `'Task delegated successfully...'` to Claude immediately after launching the loop.

Do not add `await` to the `runDelegationLoop` call in the tool handler. The tool handler must return quickly so Claude's invocation can continue.

## setupDelegationTask is called ONCE, inside runDelegationLoop

`runDelegationLoop` calls `setupDelegationTask` as its first step (line 108 of `_helpers/delegation-loop.ts`). This is the only call site. The "known issue: setupDelegationTask called twice" described in older notes is fixed — it no longer exists.

There is no separate pre-setup phase. When `runDelegationLoop` is called, setup and the loop are one contiguous execution path.

## Lazy hook resolution via `state.setHooks`

During `register()`, the plugin stores a `setHooks` callback on the module-level `state` object. After all plugins have registered, the orchestrator boot (`apps/orchestrator/src/index.ts`, lines 99-101) calls `delegationState.setHooks(orchestrator.getHooks())`. This populates `state.currentHooks` with the full resolved hook array.

The tool handler passes `state.currentHooks ?? []` to `runDelegationLoop`. If the orchestrator boot skips the `setHooks` call, `state.currentHooks` remains `null`, the empty fallback is used, and `onTaskCreate`, `onTaskComplete`, and `onTaskFailed` lifecycle hooks will never fire.

## Validation is Claude's responsibility, not the plugin's

The delegation loop does not automatically accept or reject sub-agent output. It calls `fireTaskCompleteHooks` (`onTaskComplete` hooks), which is where external validation logic lives. If no plugin implements `onTaskComplete` with rejection logic, the outcome defaults to `accepted: true` — the task completes on the first iteration.

Sub-agents are expected to signal completion via their output. Feedback from rejection is passed into the next iteration via `buildIterationPrompt`.

## DB transaction is atomic for setup, not for the loop

`setupDelegationTask` wraps thread and task creation in a `ctx.db.$transaction`. If either fails, neither record persists. However, once the loop starts running, each iteration's DB updates (status, currentIteration, result) are individual calls — not transactional. A crash mid-loop leaves the task in whatever state the last update set.

## Cost cap is checked after each iteration, not before

`queryDelegationCost` sums metric records associated with the task. The cap check happens after a sub-agent invocation completes (or fails), not before. This means the final iteration can overshoot the cap by the cost of one invocation. On cap hit, the task is immediately failed (status: `failed`) and the loop breaks. The parent thread receives a failure notification. There is no user-visible alert beyond the log and the `task:cost-cap` broadcast event.

Cost cap is read from `process.env.DELEGATION_COST_CAP_USD` at import time as a module-level constant: `const DELEGATION_COST_CAP_USD = Number(process.env.DELEGATION_COST_CAP_USD ?? '5')`. Changing the env var at runtime has no effect.

## Only the final result reaches the parent thread

`sendThreadNotification` is called once: at the end of the loop, whether the task succeeded or failed. Intermediate iterations are visible only in the task's own thread. The parent sees a single structured notification summarizing the outcome. If the task completes, the summary is the first 200 characters of the sub-agent's final output.

Sub-agents can call the `checkin` MCP tool at any point during their work to send an interim message to the parent. This uses `ctx.sendToThread` on the parent thread, not `sendThreadNotification`. The message appears as `[Check-in from task thread <id>]: <message>`.

## Backoff and failure categorization

On sub-agent invocation failure (non-zero exit code), the loop calls `categorizeFailure` and `calculateBackoffMs`. Logic errors fast-fail without retry. Other failure categories back off with a delay before the next iteration. Cost cap is re-checked after failure backoff before retrying.

## File layout

```
src/
  index.ts                          — plugin definition; MCP tool handlers (delegate, checkin)
  _helpers/
    delegation-loop.ts              — setupDelegationTask; runDelegationLoop (core loop)
    invoke-sub-agent.ts             — wraps ctx.invoker.invoke for sub-agent invocation
    handle-checkin.ts               — checkin tool handler
    build-iteration-prompt.ts       — constructs prompt with prior feedback
    fire-task-complete-hooks.ts     — runs onTaskComplete hooks and normalizes outcome
    send-thread-notification.ts     — posts structured result notification to parent thread
query-delegation-cost.ts        — sums metric costs for a task
    categorize-failure.ts           — classifies invoke errors for retry strategy
    calculate-backoff-ms.ts         — exponential backoff per failure category
    create-task-thread.ts           — (legacy helper, may be unused — check before editing)
    __tests__/                      — unit tests per helper
```
