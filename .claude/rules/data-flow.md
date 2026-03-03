# Message Data Flow

Exact execution path from user submission to assistant response.
Every file reference is verifiable — read the file before drawing conclusions about it.

---

## Full Execution Path

### Phase 0 — Web (Next.js Server Action)

File: `apps/web/src/app/(chat)/chat/_actions/send-message.ts`

```
sendMessage(threadId, content)
  prisma.message.create(role: 'user')   line 17  — user message to DB
  prisma.thread.update(lastActivity)    line 25
  revalidatePath(...)                   line 30  — triggers RSC re-render
  fetch POST /api/chat                  line 33  — fire-and-forget to orchestrator
```

The web app persists the user message itself. The orchestrator never writes the user message.

---

### Phase 1 — HTTP (Web Plugin)

File: `packages/plugins/web/src/_helpers/routes.ts`
File: `packages/plugins/web/src/index.ts`

```
POST /api/chat -> onChatMessage(threadId, content)
  ctx.broadcast('chat:message', ...)    line 29  — WebSocket to browser
  ctx.sendToThread(threadId, content)   line 33  — NOT awaited (fire-and-forget)
```

HTTP responds immediately. The Claude pipeline runs asynchronously. The browser learns the response is ready via `pipeline:complete` WebSocket event.

---

### Phase 2 — sendToThread (Orchestrator)

File: `apps/orchestrator/src/orchestrator/index.ts`
`sendToThread` is a closure inside the `context` object — defined starting at line 65.

```
sendToThread(threadId, content)
  1. Generate traceId (crypto.randomUUID)                            line 71
  2. runNotifyHooks('onPipelineStart', threadId)                     line 76
     — activity plugin writes pipeline_start status record
  3. handleMessage(threadId, 'user', content, traceId)               line 78
     — awaited: full pipeline (see Phase 3)
  4. runNotifyHooks('onPipelineComplete', threadId, result)           line 84
     — activity plugin writes pipeline_step, stream event, pipeline_complete records
     — fires BEFORE innate writes (so activity records have earlier createdAt for UI sort order)
  5. INNATE: if output non-empty:
       prisma.message.create(role:'assistant', kind:'text')          line 95
       prisma.thread.update(lastActivity)                            line 105
  6. broadcast('pipeline:complete', { threadId, ... })               line 118
     — fires AFTER DB writes (so router.refresh() on client sees persisted assistant message)
```

The separation is clean: `onPipelineStart`/`onPipelineComplete` handle all rich activity persistence (owned by the activity plugin). The orchestrator only writes the assistant text message and thread activity timestamp (innate).

---

### Phase 3 — handleMessage (pipeline)

File: `apps/orchestrator/src/orchestrator/index.ts`, function `handleMessage` at line 152

```
Step 0: prisma.thread.findUnique(threadId)         line 155 — loads sessionId, model, kind, name, customInstructions, projectId
        if !model && projectId: prisma.project.findUnique(projectId) — inherits project.model as fallback
Step 1: runNotifyHooks('onMessage')                line 166 — plugins notified, cannot modify
        pipelineSteps.push('onMessage')
        broadcast('pipeline:step', 'onMessage')    line 169
Step 2: assemblePrompt(content, threadMeta)        line 184 — builds base prompt
Step 3: runChainHooks('onBeforeInvoke', prompt)    line 190 — plugins transform prompt sequentially
        broadcast('pipeline:step', 'onBeforeInvoke') line 195
Step 4: invoker.invoke(prompt, { model, sessionId, threadId, traceId, onMessage }) line 214 — Claude invoked
        broadcast('pipeline:step', 'invoking')     line 213
     b: prisma.thread.update({ sessionId })        lines 226-229 — only if sessionId changed (innate)
Step 5: runNotifyHooks('onAfterInvoke', result)    line 233 — plugins notified, cannot modify
        broadcast('pipeline:step', 'onAfterInvoke') line 242
```

Note: stream events (thinking blocks, tool calls) are captured via `onMessage` callback passed to `invoker.invoke()` at line 214 — they accumulate in `streamEvents[]` and are returned to `sendToThread`, which passes them to `onPipelineComplete`.

Returns `{ invokeResult, prompt, pipelineSteps, streamEvents, traceId }` to `sendToThread`.

---

### Phase 4 — onBeforeInvoke: what the context plugin does

File: `packages/plugins/context/src/index.ts`, line 54

This is what Claude receives. If context or history seems wrong, the issue is here.

```
1. readContextFiles(contextDir)         — loads context/ directory (file cache)
2. formatContextSection(files)          — builds '# Context\n\n## filename\n\ncontent...'
3. Load project instructions/memory     — thread.project.instructions + thread.project.memory
4. if thread.sessionId: skip history   — Claude already has it via session resume
5. else:
     check for summaries (up to 2)    — if summaries exist, use reduced history limit (25 vs 50)
     loadHistory(db, threadId, limit) — loads last 25-50 messages chronologically
     formatHistorySection()           — builds '# Conversation History\n\n[role]: content...'
     formatSummarySection()           — builds summary section if summaries exist
6. return buildPrompt([projectInstructions, projectMemory, contextSection, summarySection, historySection, prompt])
```

The sessionId short-circuit is intentional: once a session exists, Claude's subprocess already has the conversation state. Injecting history again would duplicate it.

---

### Phase 5 — Claude SDK Session

File: `apps/orchestrator/src/invoker-sdk/index.ts`

```
invoke(prompt, { model, sessionId, threadId, traceId, onMessage })
  pool.get(threadId, model)     — get or create warm session (max 5, 8-min TTL)
  session.send(prompt, opts)    — sends to SDK subprocess, awaited with timeout
  extractResult(result)         — maps SDKResultMessage -> InvokeResult
  onMessage callback            — fires for each stream event (thinking, tool_call, tool_use_summary)
```

File: `apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts`

A session is a long-lived async generator wrapping `query()` from `@anthropic-ai/claude-agent-sdk`.
The generator yields one user message per `send()` call, keeping the Claude subprocess alive.
On error, the session is evicted and a fresh one is created on next invoke.

---

### Phase 6 — Real-time (WebSocket)

File: `packages/plugins/web/src/_helpers/ws-broadcaster.ts`

The web plugin's `onBroadcast` hook serializes every `ctx.broadcast(event, data)` call and sends it to all connected browser clients. Wire format: `{ event, data, timestamp }`.

Events during one pipeline run (in order):
1. `chat:message` — user message received
2. `pipeline:step` step: `onMessage`
3. `pipeline:step` step: `onBeforeInvoke`
4. `pipeline:step` step: `invoking`, detail: model name
5. `pipeline:step` step: `onAfterInvoke`, detail: token counts
6. `pipeline:complete` — durationMs

---

## Hook Runner Semantics

File: `packages/plugin-contract/src/_helpers/`

These determine how plugins interact. Read before assuming hooks work a certain way.

| Runner | Used for | Behavior |
|--------|----------|---------|
| `run-hook.ts` | onMessage, onAfterInvoke, onBroadcast, onPipelineStart, onPipelineComplete, onSettingsChange, onTask* | Sequential, error-isolated, cannot stop early, no return value |
| `run-chain-hook.ts` | onBeforeInvoke | Sequential, each plugin receives previous plugin's output, error keeps previous value |

**There is no parallel hook execution.** All hooks run sequentially in plugin registration order.

---

## Database Writes Per Message

| Location | Table | Data | Condition | Owner |
|----------|-------|------|-----------|-------|
| `send-message.ts:17` | Message | role:'user' | Always | Web server action |
| `send-message.ts:25` | Thread | lastActivity | Always | Web server action |
| `orchestrator/index.ts:226-229` | Thread | sessionId | First invocation only | Orchestrator (innate) |
| `orchestrator/index.ts:95-104` | Message | role:'assistant', kind:'text' | Output non-empty | Orchestrator (innate) |
| `orchestrator/index.ts:105-108` | Thread | lastActivity | Output non-empty | Orchestrator (innate) |
| Activity plugin `onPipelineStart` | Message | kind:'status' pipeline_start | Always | Activity plugin |
| Activity plugin `onPipelineComplete` | Message | kind:'pipeline_step' | Per step | Activity plugin |
| Activity plugin `onPipelineComplete` | Message | kind:'thinking'/'tool_call'/'tool_result' | Per event | Activity plugin |
| Activity plugin `onPipelineComplete` | Message | kind:'status' pipeline_complete | Always | Activity plugin |

---

## Key Files Reference

| File | What it owns |
|------|-------------|
| `packages/plugin-contract/src/index.ts` | Every type, interface, and hook signature. Start here. |
| `apps/orchestrator/src/orchestrator/index.ts` | The pipeline. handleMessage + sendToThread + PluginContext construction. |
| `apps/orchestrator/src/plugin-registry/index.ts` | Plugin registration order (14 plugins). DB-driven enable/disable. |
| `apps/orchestrator/src/invoker-sdk/index.ts` | Session pool, timeout wrapper, stream event mapping. |
| `apps/orchestrator/src/tool-server/index.ts` | MCP tool server. Plugin tools exposed as `pluginName__toolName`. |
| `packages/plugins/web/src/index.ts` | HTTP server + WebSocket broadcaster. The onChatMessage bridge. |
| `packages/plugins/context/src/index.ts` | History + context file + project injection into prompts. |
| `packages/plugins/activity/src/index.ts` | Rich activity persistence via onPipelineStart + onPipelineComplete. |
| `packages/plugins/delegation/src/index.ts` | delegate + checkin MCP tools + delegation loop. |
| `apps/web/src/app/(chat)/chat/_actions/send-message.ts` | User message to DB + POST to orchestrator. |
