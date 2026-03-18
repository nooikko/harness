# Live Delegation Card Feature — Data Flow Analysis

## Delegation Loop Lifecycle Overview

The delegation system is entirely **background-driven via fire-and-forget MCP tool**.

### Key Entry Point (Explicit vs Implicit)
- **Explicit:** Claude calls `delegation__delegate` MCP tool
- **Handler:** Returns immediately ("Task delegated successfully...") without awaiting
- **Actual work:** `runDelegationLoop(ctx, allHooks, options)` runs in background as fire-and-forget

### Phases of Execution

#### Phase 1: Setup (setupDelegationTask)
```
1. Create thread record (kind: 'task', status: 'active', sourceId: task-<uuid>)
2. Create OrchestratorTask record (status: 'pending', currentIteration: 0)
3. Fire onTaskCreate hooks
4. Broadcast: task:created { taskId, threadId, parentThreadId }
```

#### Phase 2-N: Iteration Loop
For each iteration (i=1 to maxIterations):

**Build & Invoke:**
1. Update task status → 'running', set currentIteration = i
2. Persist user message (iterationPrompt) to task thread
3. **Invoke sub-agent** with `onMessage` callback for streaming events
   - Each stream event (thinking, tool_call, tool_result) broadcasts:
     `task:stream { taskId, threadId, parentThreadId, iteration, event }`
   - Stream events are NOT persisted; only final output is persisted
4. Persist assistant response to task thread

**Validate (via onTaskComplete hooks):**
5. Update task status → 'evaluating'
6. Fire validator plugin's onTaskComplete hook
   - Validator calls Opus rubric evaluation (blocking)
   - Throws if verdict is 'fail', otherwise returns silently
7. Broadcast: `task:evaluated { taskId, threadId, iteration, accepted }`

**Accept Path:**
8. If accepted:
   - Update task: status='completed', result=output
   - Update thread: status='completed'
   - Broadcast: `task:validated { taskId, threadId, parentThreadId, iterations }`
   - Call sendThreadNotification (creates system message in parent thread)
   - Return { status: 'completed', result, iterations }

**Reject Path:**
9. If rejected (validator threw):
   - Build feedback from error message
   - Broadcast: `task:progress { taskId, threadId, parentThreadId, iteration, maxIterations, status: 'rejected', feedback }`
   - Check cost cap (if exceeded, break loop)
   - Continue to next iteration with feedback appended to prompt

#### Phase 3: Failure (Max iterations exhausted)
```
1. Update task: status='failed'
2. Update thread: status='failed'
3. Fire onTaskFailed hooks
4. Broadcast: task:failed { taskId, threadId, parentThreadId, iterations, error }
5. Call sendThreadNotification with status='failed'
6. Return { status: 'failed', result: null, iterations }
```

## WebSocket Events Currently Broadcast

### During Setup
- `task:created` → `{ taskId, threadId, parentThreadId }`

### During Each Iteration
- `task:stream` → `{ taskId, threadId, parentThreadId, iteration, event: InvokeStreamEvent }`
  - Fires for EVERY streaming token/thinking block/tool call
- `task:evaluated` → `{ taskId, threadId, iteration, accepted: boolean }`

### On Task Completion
- `task:validated` → `{ taskId, threadId, parentThreadId, iterations }`
- `thread:notification` → `{ parentThreadId, taskThreadId, taskId, status }`

### On Task Rejection (Retry)
- `task:progress` → `{ taskId, threadId, parentThreadId, iteration, maxIterations, status: 'rejected', feedback }`

### On Cost Cap Hit
- `task:cost-cap` → `{ taskId, threadId, spent, cap }`

### On Task Failure
- `task:failed` → `{ taskId, threadId, parentThreadId, iterations, error }`

### After Completion/Failure
- `thread:notification` → `{ parentThreadId, taskThreadId, taskId, status }`

## Data Available at Each Step

### Setup Phase
- **Task record:** `{ id, threadId, status, prompt, maxIterations, currentIteration, createdAt }`
- **Thread record:** `{ id, kind: 'task', status: 'active', name, parentThreadId, projectId }`

### Per-Iteration Data
- **InvokeResult:** `{ output, exitCode, error, inputTokens, outputTokens, durationMs }`
- **AgentRun (recorded immediately after invoke):** `{ id, taskId, threadId, model, inputTokens, outputTokens, costEstimate, durationMs, status, completedAt }`
- **TaskCompleteOutcome (from validator):** `{ accepted, feedback? }`

### At Broadcast Time
Events include: `taskId`, `threadId`, `parentThreadId`, `iteration` (current), `maxIterations` (max), `accepted` (boolean for evaluated), `feedback` (string for rejected), `spent`, `cap`, `error` (message).

## Current Client-Side Handling

### WebSocket Provider (ws-provider.tsx)
- Manages WebSocket connection with exponential backoff reconnect
- Exposes `useWs(eventName)` hook returning `{ lastEvent, isConnected }`
- All events flow through same pub/sub mechanism

### Current Event Consumers
- **pipeline:complete** — triggers `router.refresh()` in ChatArea
- **pipeline:step** — triggers smooth scroll-to-bottom
- **thread:deleted** — navigates away from chat

### IMPORTANT: No Current Consumer for Delegation Events
- `task:*` events are broadcast but **NOT consumed on the client**
- `thread:notification` is broadcast but only used for final notification message creation
- **No real-time delegation status card currently exists**

## Intermediate States NOT Currently Broadcast

These would need to be added for a live delegation card:

1. **Iteration start** — iteration i beginning invocation
   - Could reuse `task:stream` with first event, or add `task:iteration-started`
2. **Iteration complete** — iteration finished before validation
   - Could be derived from `task:evaluated`, already broadcast
3. **Token counts per iteration** — AgentRun persisted but not broadcast
   - Would need new event: `task:iteration-metrics { taskId, iteration, inputTokens, outputTokens, costEstimate, durationMs }`

## Critical Constraints for Live Card Feature

### 1. Fire-and-forget Loop
- Tool handler returns immediately; entire loop runs in background
- Parent thread never blocks waiting for task
- Parent thread sees only final notification (cross-thread notification message)

### 2. Stream Events (High Volume)
- `task:stream` fires for EVERY streaming token/thinking block
- Cannot be consumed naively (performance)
- Need client-side debouncing or aggregation

### 3. No Backward Fetch
- Events are ephemeral (not stored in DB except final result)
- If client connects after task starts, it misses history
- Live card must appear on screen at task:created time

### 4. Two-Thread Model
- Delegation happens in SEPARATE task thread (`kind: 'task'`)
- Parent thread only receives final notification message
- Must cross-thread link via metadata: `{ sourceThreadId, taskId, status }`

### 5. Notification Message
- Created by `sendThreadNotification` as system role message
- Stored in parent thread with metadata: `{ type: 'cross-thread-notification', sourceThreadId, taskId, status, iterations }`
- Current rendering: `NotificationMessage` component shows green/red banner + "View thread" link

## Broadcast Integration Points

### Where Broadcasts Happen
- Delegation plugin: `ctx.broadcast('task:*', ...)`
- Web plugin receives all broadcasts via `onBroadcast` hook
- Web plugin's ws-broadcaster serializes to all WebSocket clients

### Wire Format
```json
{ "event": "task:validated", "data": { "taskId": "...", "threadId": "...", ... }, "timestamp": 1234567890 }
```

## Available Broadcast Events for Live Card

### Can be consumed directly (already broadcast):
1. `task:created` — task started
2. `task:evaluated` — validation result available (accepted/rejected)
3. `task:progress` — retry feedback
4. `task:cost-cap` — cost exceeded
5. `task:failed` — max iterations reached
6. `task:validated` — task completed successfully

### Requires new broadcast (currently only logged/persisted):
1. Stream metrics per iteration (tokens, cost, duration)
2. Iteration start marker (optional, can derive from first task:stream)

## Key Implementation Decisions

### Use WebSocket Pub/Sub or Create New Hook?
**WebSocket is correct.** All client events flow through `ctx.broadcast()` → web plugin → WebSocket. No need for new hook type.

### Where Should the Card Live?
**In parent thread's ChatArea.** The notification message is in the parent thread. A live card would appear inline or as a collapsible widget above/below the notification.

### How to Handle Stream Events?
**Aggregate on client side.** Don't render every token. Group by 100ms window or aggregate until task:evaluated fires.

### What If Client Connects After Task Starts?
**Card won't appear retroactively.** Only live updates shown. Previous state available via "View thread" link to task thread. Could fetch task status from `/api/tasks/:id` endpoint if needed.

### Ordering Guarantees?
**Sequential per task.** Events fire in order: created → stream → evaluated → (progress|validated|failed). No parallel event delivery within one task.

## Summary: What Needs Implementation

### For Live Delegation Card (MVP)
1. **Broadcast hook for client:** Subscribe to `task:created`, `task:evaluated`, `task:progress`, `task:failed`, `task:validated`
2. **Client-side component:** Overlay or inline card showing current iteration, status, feedback
3. **Debouncing:** Aggregate `task:stream` events (high volume)
4. **Cost display:** Track cumulative cost from AgentRun records OR broadcast metrics per iteration

### NOT needed (already exists):
- New broadcast events (most are already there)
- New database schema
- New orchestrator hooks
- Changes to delegation loop

### Optional (enhancement):
- New broadcast event for iteration metrics (tokens, cost)
- Stream event aggregation on backend instead of client
- Task thread real-time sync (sub-thread message updates)
