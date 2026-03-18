# Live Delegation Card

**Status:** Not started
**Date:** 2026-03-17
**Complexity:** MEDIUM — frontend-heavy, minor backend broadcast fixes needed
**Last reviewed:** 2026-03-17 (adversarial review applied)

## Problem

When the orchestrating agent delegates work to a sub-agent, the user has zero visibility into what's happening. A cross-thread notification banner appears AFTER the task completes, but:

1. **No real-time visibility** — can't see what sub-agents are doing while they work
2. **No prompt auditing** — can't verify the orchestrating agent is giving good prompts (delegating thinking, not micro-managing)
3. **No iteration visibility** — can't see validation rejections, feedback, retry attempts
4. **Parent agent can't evaluate and re-delegate** — the current notification is a dead-end; the parent agent should receive structured results, evaluate quality, and kick off another delegation if needed

## Requirements

### For the Human User (UI)
- Live-updating card in the parent thread's chat showing delegation status
- See the **prompt** given to the sub-agent (audit: is it delegating thinking or dictating code?)
- See **iteration progress** — which attempt, validation feedback on rejection, cost accumulating
- See **final result** — completed/failed, with link to view the full task thread
- **v1 shows activity counts** (3 thinking blocks, 2 tool calls) — NOT a full mini Claude Code view. Inline thinking/tool preview is a future enhancement.

### For the Parent Agent (Conversation Flow)
- When a task completes, the parent agent receives the **full result** in its thread via `ctx.sendToThread` (not a DB insert — see Critical Note below)
- Parent agent can evaluate the result quality and re-delegate if unsatisfied
- This loop can run 10-15 iterations without human intervention
- The human can audit all of this in the chat history

## Existing Broadcast Infrastructure

The delegation plugin already broadcasts these events during the loop:

| Event | When | Payload | Has `parentThreadId`? |
|-------|------|---------|----------------------|
| `task:created` | Task starts | `taskId, threadId, parentThreadId` | Yes |
| `task:stream` | Per token/thinking/tool | `taskId, parentThreadId, iteration, event` | Yes |
| `task:evaluated` | After validation | `taskId, threadId, iteration, accepted` | **No** — correlate by `taskId` |
| `task:progress` | On rejection/retry | `taskId, parentThreadId, iteration, maxIterations, feedback` | Yes |
| `task:validated` | Task completes | `taskId, parentThreadId, iterations` | Yes |
| `task:failed` | Max iterations hit | `taskId, parentThreadId, iterations, error` | Yes |
| `task:cost-cap` | Budget exceeded | `taskId, threadId, spent, cap` | **No** — correlate by `taskId` |

WebSocket delivery: `ctx.broadcast()` → web plugin `onBroadcast` → `ws-broadcaster.ts` → browser.

**Note:** `task:evaluated` and `task:cost-cap` do NOT include `parentThreadId`. The hook must correlate these by `taskId` against known tasks, not by filtering `parentThreadId`.

## Critical Note: Session Resumption and Parent Re-Delegation

The context plugin's `onBeforeInvoke` **skips history injection when the parent thread has an active `sessionId`** (which is the common case — sessions persist with 8-min TTL). This means a notification message quietly inserted via `ctx.db.message.create` will sit in the DB **unseen by the Claude subprocess**.

**Therefore:** The delegation completion notification MUST use `ctx.sendToThread(parentThreadId, resultContent)` instead of `ctx.db.message.create`. This runs the full pipeline (onPipelineStart → handleMessage → onPipelineComplete), which ensures the parent agent's Claude subprocess receives the result and can evaluate + re-delegate. This is a critical change from the current `send-thread-notification.ts` approach.

## Key Design Decisions

1. **Auto-response:** Parent agent is automatically invoked via `sendToThread` when delegation completes. No human trigger needed.
2. **FIFO queuing:** If the parent thread is mid-pipeline (responding to user or another delegation), the incoming `sendToThread` queues behind it. Requires per-thread serialization in the orchestrator.
3. **Each delegation is independent:** The outer loop is NOT "retry same request." Each delegation gets new, refined instructions from the parent. The live card shows each as a separate card. The chat history IS the audit trail.
4. **No attempt counter across delegations:** Cards are standalone. The parent agent's messages in the chat show the progression of refinement.

## Implementation Phases

### Phase 0: Per-Thread Pipeline Serialization

**Problem:** `sendToThread` has no per-thread locking. Two concurrent calls to the same thread (e.g., user sends a message while a delegation result arrives) will race — both call `handleMessage` simultaneously, both write assistant responses, potentially corrupting the Claude session.

**Note (C1+C2 fix landed):** Tool context isolation is already solved — each session has its own `contextRef` activated by `drainQueue`, so concurrent pipelines on *different* threads no longer corrupt each other's tool metadata. However, Phase 0 is still required because concurrent pipelines on the *same* thread can still produce duplicate assistant messages and fight over `sessionId` updates. The FIFO queue prevents this.

**This is a correctness fix, not a feature.** It qualifies as "innate" per architectural-invariants.md — the pipeline must function correctly for every message.

**Solution:** Add a per-thread promise chain to `sendToThread` in `apps/orchestrator/src/orchestrator/index.ts`:

```typescript
const threadLocks = new Map<string, Promise<void>>();

sendToThread: async (threadId: string, content: string) => {
  const previous = threadLocks.get(threadId) ?? Promise.resolve();
  const current = previous.then(async () => {
    // ... existing sendToThread body ...
  }).catch(() => {});  // don't let one failure block the queue
  threadLocks.set(threadId, current);
  await current;
};
```

This ensures FIFO ordering: if a user message is mid-pipeline and a delegation result arrives, the delegation result waits and runs next. No messages are dropped or reordered.

**Files changed:**
- `apps/orchestrator/src/orchestrator/index.ts` — add `threadLocks` Map + chain in `sendToThread`

### Phase 1: Backend Broadcast Fixes

Small changes to make the live card possible:

#### 1a. Add prompt + maxIterations to `task:created` broadcast

File: `packages/plugins/delegation/src/_helpers/setup-delegation-task.ts` (line ~80)

```typescript
await ctx.broadcast("task:created", {
  taskId,
  threadId,
  parentThreadId,
  prompt: prompt.slice(0, 2000),  // truncated for broadcast; full text in DB
  maxIterations,
});
```

#### 1b. Add `parentThreadId` to `task:cost-cap` broadcast

File: `packages/plugins/delegation/src/_helpers/delegation-loop.ts` (lines ~114, ~208)

```typescript
await ctx.broadcast("task:cost-cap", {
  taskId,
  threadId,
  parentThreadId,  // ADD
  spent,
  cap,
});
```

#### 1c. Change notification delivery to use `ctx.sendToThread`

File: `packages/plugins/delegation/src/_helpers/send-thread-notification.ts`

Replace `ctx.db.message.create` with `ctx.sendToThread(parentThreadId, content)`. The content should include the sub-agent's result (truncated to ~2000 chars) so the parent agent can evaluate quality:

```typescript
const content = status === 'completed'
  ? `Delegation task completed in ${iterations} iteration(s).\n\n## Result\n\n${result.slice(0, 2000)}\n\nReview the result above. If it meets the original requirements, proceed. If not, re-delegate with specific feedback about what's missing.`
  : `Delegation task failed after ${iterations} iteration(s).\n\nError: ${error}\n\nConsider re-delegating with adjusted requirements or a different approach.`;

await ctx.sendToThread(parentThreadId, content);
```

This runs the full pipeline, ensuring the parent agent's Claude subprocess sees the result regardless of session state. The parent agent can then call `delegation__delegate` again if unsatisfied.

**Important:** Since `sendToThread` runs the full pipeline (including `onBeforeInvoke`, Claude invocation, etc.), the parent agent will automatically respond to the delegation result. This is the desired behavior — the parent agent evaluates and takes action.

### Phase 2: Live Delegation Card (Frontend)

#### 2a. `apps/web/src/app/(chat)/chat/_helpers/use-delegation-tasks.ts`

React hook using the lower-level `subscribe` API from `WsContext` directly (NOT 6 separate `useWs()` calls, which would create 6 `useState` atoms and cause excessive re-renders from `task:stream` per-token events).

```typescript
type DelegationTask = {
  taskId: string;
  threadId: string;        // task thread (where sub-agent runs)
  parentThreadId: string;  // parent thread (where card renders)
  prompt?: string;         // for audit display (from task:created)
  status: "pending" | "running" | "evaluating" | "completed" | "failed";
  iteration: number;
  maxIterations: number;
  thinkingCount: number;   // accumulated thinking blocks this iteration
  toolCallCount: number;   // accumulated tool calls this iteration
  lastFeedback?: string;   // validation rejection reason
  error?: string;          // failure error message
  createdAt: Date;
  updatedAt: Date;
};
```

Implementation approach:
- Use `useContext(WsContext)` to get `subscribe` function
- Single subscriber callback handles ALL `task:*` events
- Internal state managed via `useRef` + `useState` with **batched updates** (200ms debounce for `task:stream`)
- `task:stream` events update a ref (no re-render), flushed to state every 200ms via `setInterval`
- `task:evaluated` and `task:cost-cap` events matched by `taskId` (no `parentThreadId` in payload)
- Completed/failed tasks stay visible until user dismisses manually (no aggressive auto-dismiss)
- On WebSocket reconnection (`isConnected` transitions false→true), re-seed from DB

#### 2b. `apps/web/src/app/(chat)/chat/_components/delegation-card.tsx`

Single task card component:

```
┌─────────────────────────────────────────────────┐
│ ● Running  Iteration 2/4         [View] [✕]     │
│ ━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░ 50%           │
│                                                  │
│ ▸ Prompt (click to expand for audit)             │
│                                                  │
│ ⟳ Thinking... · 3 thinking blocks · 1 tool call │
│                                                  │
│ ▸ Last rejection: "Missing error handling for    │
│   the edge case described in requirement #3"     │
└─────────────────────────────────────────────────┘
```

Status colors: running=blue, evaluating=amber, completed=green, failed=red.

Critical feature: **Collapsible prompt section** for auditing what the orchestrator told the sub-agent.

#### 2c. `apps/web/src/app/(chat)/chat/_components/delegation-stack.tsx`

Container rendering all active delegation cards for the current thread. Stacks vertically, newest on top. Inserted into `chat-area.tsx` after `<PipelineActivity>`.

Multiple concurrent delegations handled naturally — each card is independent, keyed by `taskId`.

### Phase 3: Catch-Up on Page Load / Reconnection

**Problem:** WebSocket events are ephemeral. Page refresh or WiFi drop loses live state.

**Solution:** Server action that queries active tasks for a thread:

```typescript
// apps/web/src/app/(chat)/chat/_actions/get-active-delegations.ts
const tasks = await prisma.orchestratorTask.findMany({
  where: {
    thread: { parentThreadId },  // JOIN through Thread model
    status: { in: ['pending', 'running', 'evaluating'] },
  },
  select: { id: true, threadId: true, prompt: true, status: true, currentIteration: true, maxIterations: true },
});
```

Note: `OrchestratorTask` has no `parentThreadId` field — the query joins through `Thread.parentThreadId`.

Called on:
- Hook mount (initial page load)
- WebSocket reconnection (`isConnected` transitions false → true)

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `apps/orchestrator/src/orchestrator/index.ts` | Modify | Add per-thread pipeline serialization (FIFO queue) |
| `packages/plugins/delegation/src/_helpers/setup-delegation-task.ts` | Modify | Add `prompt`, `maxIterations` to `task:created` broadcast |
| `packages/plugins/delegation/src/_helpers/delegation-loop.ts` | Modify | Add `parentThreadId` to `task:cost-cap` broadcasts |
| `packages/plugins/delegation/src/_helpers/send-thread-notification.ts` | Modify | Use `ctx.sendToThread` with full result for parent re-delegation |
| `apps/web/src/app/(chat)/chat/_helpers/use-delegation-tasks.ts` | Create | WS event aggregation with batched updates |
| `apps/web/src/app/(chat)/chat/_components/delegation-card.tsx` | Create | Live task card with progress, prompt audit |
| `apps/web/src/app/(chat)/chat/_components/delegation-stack.tsx` | Create | Container for multiple cards |
| `apps/web/src/app/(chat)/chat/_components/chat-area.tsx` | Modify | Add `<DelegationStack>` after `<PipelineActivity>` |
| `apps/web/src/app/(chat)/chat/_actions/get-active-delegations.ts` | Create | Server action for catch-up query |

### Test Files

| File | Tests |
|------|-------|
| `apps/web/.../chat/_helpers/__tests__/use-delegation-tasks.test.ts` | Event processing, filtering, debounce, auto-dismiss |
| `apps/web/.../chat/_components/__tests__/delegation-card.test.tsx` | Status rendering, progress bar, prompt audit, dismiss |
| `apps/web/.../chat/_components/__tests__/delegation-stack.test.tsx` | Multiple cards, ordering, empty state |
| `packages/plugins/delegation/src/_helpers/__tests__/send-thread-notification.test.ts` | Updated for `sendToThread` flow |

## What This Does NOT Change

- Delegation loop execution logic (fire-and-forget, background)
- Validator plugin (Opus rubric validation)
- Database schema (no migrations)
- WebSocket infrastructure (broadcasts already exist)

**Note:** Phase 0 touches orchestrator core (`sendToThread`), but it's a correctness fix — concurrent `sendToThread` calls to the same thread is already a bug, not something introduced by this feature.

## Prerequisites (already landed)

**C1+C2 context isolation** — `OrchestratorDeps` no longer has `setActiveThread`, `setActiveTraceId`, `setActiveTaskId`, or `consumeToolBlocks`. The delegation plugin now passes `taskId` through `InvokeOptions` instead of `ctx.setActiveTaskId()`. Implementers should not reference these removed APIs.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `task:stream` floods browser (fires per token) | MEDIUM | Ref-based accumulation, 200ms flush to state, counts only |
| `sendToThread` for notification runs full pipeline (Claude responds) | MEDIUM | Intentional — parent agent SHOULD respond. Phase 0 serialization ensures it queues behind any in-flight pipeline run |
| Concurrent `sendToThread` calls to same thread (pre-existing bug) | HIGH | Phase 0 fixes this with per-thread FIFO queue — required regardless of this feature. Tool context isolation already landed (C1+C2), but same-thread pipeline serialization is still needed for message/session integrity. |
| Page refresh loses live state | LOW | Phase 3 catch-up query seeds from DB + reconnection re-seed |
| Large prompts in `task:created` broadcast | LOW | Truncate to 2000 chars; full text queryable from OrchestratorTask.prompt |
| Multiple concurrent delegations | LOW | Stack layout, independent cards, natural ordering |
| Check-in messages (`delegation__checkin`) appear alongside card | LOW | They're separate — check-ins are chat messages, card is a floating overlay. Both visible, no conflict |

## Explicit Non-Goals (v1)

These are deferred to future work, NOT part of this implementation:

- **Mini Claude Code view** — v1 shows activity counts only, not inline thinking/tool content
- **Cost display per iteration** — would need a new broadcast or DB query
- **Inline thinking preview** — truncated thinking text in the card
- **Tool call details** — which specific tools the sub-agent is calling
- **Delegation history timeline** — scrollable history of past delegations
- **Audio notifications** on completion/failure
