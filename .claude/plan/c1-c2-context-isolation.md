# C1+C2: Per-Invocation Tool Context Isolation

**Status:** Complete (not yet committed)
**Date:** 2026-03-17
**Complexity:** HIGH — orchestrator core refactor, 8 source + 5 test files

## Problem

Global mutable `contextRef` shared across all concurrent pipelines. When two pipelines run concurrently, `setActiveThread` overwrites the shared ref — tool calls from pipeline A get pipeline B's threadId.

## Solution

Per-request meta on the session queue, activated by `drainQueue()` when the request becomes active. Each session has its own `contextRef` that the MCP tool server captures. Context is only updated when a request transitions from pending to active, not when `send()` is called.

## Phases

### Phase 1: Types (no behavioral change)
- [ ] 1. Create `SessionContextRef` type in `apps/orchestrator/src/invocation-context/index.ts`
- [ ] 2. Add `taskId` + `pendingBlocks` to `InvokeOptions` in `packages/plugin-contract/src/index.ts`

### Phase 2: Session layer
- [ ] 3. `create-session.ts` — add `meta` to `PendingRequest`, `drainQueue()` copies meta to session-local `contextRef`
- [ ] 4. `session-pool.ts` — update `SessionConfig.mcpServerFactory` to accept `SessionContextRef`
- [ ] 5. `invoker/index.ts` — construct meta from `InvokeOptions`, pass to `session.send()`

### Phase 3: Tool server
- [ ] 6. Rename `ToolContextRef` → `SessionContextRef` in `tool-server/index.ts`

### Phase 4: Wire orchestrator
- [ ] 7. `orchestrator/index.ts` — remove setter deps, create per-invocation `pendingBlocks`, replace `consumeToolBlocks`
- [ ] 8. `index.ts` (boot) — remove global `contextRef`, factory passes per-session ref
- [ ] 9. `invoke-sub-agent.ts` — pass `taskId` via `InvokeOptions`
- [ ] 10. `plugin-contract` — remove `setActiveTaskId` from `PluginContext`

### Phase 5: PluginContext delivery
- [ ] 11. Invoker stores `pluginContext` via `setPluginContext()`, includes in request meta

## Key Design Decision

Context is activated in `drainQueue()`, not in `send()`:
```
Request A: send(promptA, metaA) → active → drainQueue copies metaA to contextRef
Request B: send(promptB, metaB) → queued (contextRef still has A's values)
A completes → drainQueue pops B → copies metaB to contextRef
```

## Interaction with Other Plans

- `live-delegation-card.md` Phase 0 (per-thread FIFO queue) is complementary — both modify `sendToThread` but touch different aspects. Either can land first.

## Success Criteria

- [ ] No global mutable `contextRef`
- [ ] `setActiveThread`, `setActiveTraceId`, `setActiveTaskId`, `consumeToolBlocks` removed
- [ ] Each session creates its own context ref for its MCP tool server
- [ ] `drainQueue()` activates per-request meta only when request becomes active
- [ ] Two concurrent pipelines get correct threadId in tool calls
- [ ] Delegation passes taskId through InvokeOptions
- [ ] pendingBlocks are per-invocation
- [ ] All tests pass
