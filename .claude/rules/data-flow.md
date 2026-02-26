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

File: `packages/plugins/web/src/_helpers/routes.ts`, line 39
File: `packages/plugins/web/src/index.ts`

```
POST /api/chat → onChatMessage(threadId, content)
  ctx.broadcast('chat:message', ...)    line 29  — WebSocket to browser
  ctx.sendToThread(threadId, content)   line 33  — NOT awaited (fire-and-forget)
```

HTTP responds immediately. The Claude pipeline runs asynchronously. The browser learns the response is ready via `pipeline:complete` WebSocket event.

---

### Phase 2 — sendToThread (Orchestrator)

File: `apps/orchestrator/src/orchestrator/index.ts`
`sendToThread` is a closure inside the `context` object — defined starting at line 67.

**Intended behavior** (innate — what belongs in orchestrator core):
```
sendToThread(threadId, content)
  handleMessage(threadId, 'user', content)              — awaited: full 8-step pipeline
  if output:
    prisma.message.create(role:'assistant', kind:'text') — assistant message to DB
    prisma.thread.update(lastActivity)
```

**Current implementation has additional persistence as technical debt** (lines 75-158): pipeline_start status, pipeline_step records, thinking/tool_call/tool_result stream events, and pipeline_complete status are all hardcoded in `sendToThread`. This violates the innate/extension principle — this is Rich Activity plugin behavior that leaked into the orchestrator core. The refactor direction is to move this into a dedicated activity plugin.

Do not add more persistence to `sendToThread`. New persistence belongs in a plugin using `onAfterInvoke` or a dedicated hook.

---

### Phase 3 — handleMessage (8-step pipeline)

File: `apps/orchestrator/src/orchestrator/index.ts`, function `handleMessage` at line 165

```
Step 0: prisma.thread.findUnique(threadId)         line 171 — loads sessionId, model, kind, name
Step 1: runNotifyHooks('onMessage')                line 178 — plugins notified, cannot modify
        pipelineSteps.push('onMessage')
        broadcast('pipeline:step', 'onMessage')    line 180
Step 2: assemblePrompt(content, threadMeta)        line 188 — builds base prompt
Step 3: runChainHooks('onBeforeInvoke', prompt)    line 192 — plugins transform prompt sequentially
        broadcast('pipeline:step', 'onBeforeInvoke') line 194
Step 4: invoker.invoke(prompt, { model, sessionId, onMessage }) line 205 — Claude invoked
        broadcast('pipeline:step', 'invoking')     line 204
     b: prisma.thread.update({ sessionId })        lines 215-220 — only if sessionId changed (innate)
Step 5: runNotifyHooks('onAfterInvoke', result)    line 223 — plugins notified, cannot modify
        broadcast('pipeline:step', 'onAfterInvoke') line 226
Step 6: parseCommands(result.output)               line 234 — regex extracts /command lines
Step 7: runCommandHooks('onCommand', commands)     line 238 — first plugin returning true wins
Step 8: broadcast('pipeline:complete')             line 249
```

Note: stream events (thinking blocks, tool calls) are captured via `onMessage` callback passed to `invoker.invoke()` at line 205 — they accumulate in `streamEvents[]` and are persisted by `sendToThread` after `handleMessage` returns.

Returns `{ invokeResult, prompt, commandsHandled, pipelineSteps, streamEvents }` to `sendToThread`.

---

### Phase 4 — onBeforeInvoke: what the context plugin does

File: `packages/plugins/context/src/index.ts`, line 49

This is what Claude receives. If context or history seems wrong, the issue is here.

```
1. readContextFiles(contextDir)         — loads context/ directory (file cache)
2. formatContextSection(files)          — builds '# Context\n\n## filename\n\ncontent...'
3. if thread.sessionId: skip history   — Claude already has it via session resume
4. else: loadHistory(db, threadId, 50) — loads last 50 messages chronologically
         formatHistorySection()        — builds '# Conversation History\n\n[role]: content...'
5. return [contextSection, historySection, basePrompt].join('\n\n---\n\n')
```

The sessionId short-circuit is intentional: once a session exists, Claude's subprocess already has the conversation state. Injecting history again would duplicate it.

---

### Phase 5 — Claude SDK Session

File: `apps/orchestrator/src/invoker-sdk/index.ts`, line 53

```
invoke(prompt, { model, sessionId, onMessage })
  pool.get(threadId, model)     — get or create warm session (max 5, 8-min TTL)
  session.send(prompt, opts)    — sends to SDK subprocess, awaited with timeout
  extractResult(result)         — maps SDKResultMessage → InvokeResult
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
6. `pipeline:complete` — commandsHandled[], durationMs

---

## Hook Runner Semantics

File: `packages/plugin-contract/src/_helpers/`

These determine how plugins interact. Read before assuming hooks work a certain way.

| Runner | Used for | Behavior |
|--------|----------|---------|
| `run-hook.ts` | onMessage, onAfterInvoke, onBroadcast, onTask* | Sequential, error-isolated, cannot stop early, no return value |
| `run-chain-hook.ts` | onBeforeInvoke | Sequential, each plugin receives previous plugin's output, error keeps previous value |
| `run-hook-with-result.ts` | onCommand | Sequential, stops and returns true as soon as one plugin returns true |

**There is no parallel hook execution.** All hooks run sequentially in plugin registration order.

---

## Database Writes Per Message

Intended architecture (what should be innate vs plugin-owned):

| Location | Table | Data | Condition | Owner |
|----------|-------|------|-----------|-------|
| `send-message.ts:17` | Message | role:'user' | Always | Web server action |
| `send-message.ts:25` | Thread | lastActivity | Always | Web server action |
| `orchestrator/index.ts:215-220` | Thread | sessionId | First invocation only | Orchestrator (innate) |
| `orchestrator/index.ts:130-132` | Message | role:'assistant', kind:'text' | Output non-empty | Orchestrator (innate) |
| `orchestrator/index.ts:133-136` | Thread | lastActivity | Output non-empty | Orchestrator (innate) |
| *(should be activity plugin)* | Message | kind:'status' pipeline_start/complete | Always | **Technical debt in sendToThread** |
| *(should be activity plugin)* | Message | kind:'pipeline_step' | Per step | **Technical debt in sendToThread** |
| *(should be activity plugin)* | Message | kind:'thinking'/'tool_call'/'tool_result' | Per event | **Technical debt in sendToThread** |

---

## Key Files Reference

| File | What it owns |
|------|-------------|
| `packages/plugin-contract/src/index.ts` | Every type, interface, and hook signature. Start here. |
| `apps/orchestrator/src/orchestrator/index.ts` | The pipeline. handleMessage + sendToThread + PluginContext construction. |
| `apps/orchestrator/src/plugin-registry/index.ts` | Plugin registration order. DB-driven enable/disable. |
| `apps/orchestrator/src/invoker-sdk/index.ts` | Session pool, timeout wrapper, stream event mapping. |
| `apps/orchestrator/src/tool-server/index.ts` | MCP tool server. Plugin tools exposed as `pluginName__toolName`. |
| `packages/plugins/web/src/index.ts` | HTTP server + WebSocket broadcaster. The onChatMessage bridge. |
| `packages/plugins/context/src/index.ts` | History + context file injection into prompts. |
| `packages/plugins/delegation/src/index.ts` | /delegate command + delegation loop. |
| `apps/web/src/app/(chat)/chat/_actions/send-message.ts` | User message to DB + POST to orchestrator. |
