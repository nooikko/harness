# Architectural Invariants

Before recommending any change to this system, read this file completely.
The most common failure mode is concluding "the system doesn't support X" when the hook system already provides the extension point.

---

## The Core Design Principle

The orchestrator has exactly two responsibilities:

1. **Define the pipeline** — fire hooks at each step in the right order
2. **Enable plugins** — load them, pass them PluginContext, let them decide what to do

That is all. Anything that is not one of those two things does not belong in the orchestrator core.

**Innate** (belongs in orchestrator core) means:
- It must run for every single message without exception, OR
- It enables the plugin system to function at all (plugin loading, PluginContext construction, hook runner invocation)

**Extension** (belongs in a plugin) means:
- Any behavior that augments, reacts to, or modifies the pipeline
- Any side effect: DB writes, HTTP calls, broadcasts, file I/O
- Any feature that could conceivably be disabled or swapped out

---

## Before Recommending ANY Change

Work through this decision tree. Do not skip steps.

### Step 1 — Read the plugin contract

File: `packages/plugin-contract/src/index.ts`

Read `PluginHooks` completely. The hooks are:

| Hook | When it fires | What it can do |
|------|--------------|----------------|
| `onMessage` | Step 1 — after message received | Notification only (cannot modify) |
| `onBeforeInvoke` | Step 3 — after prompt assembled, before Claude is called | **Can transform the prompt** (chain hook — each plugin receives previous output) |
| `onAfterInvoke` | Step 5 — after Claude returns | Notification only (cannot modify) |
| `onPipelineStart` | In sendToThread — before handleMessage | Notification only (fires before pipeline begins) |
| `onPipelineComplete` | In sendToThread — after handleMessage returns | Notification only (receives full result: invokeResult, pipelineSteps, streamEvents) |
| `onSettingsChange` | Any time `ctx.notifySettingsChange(pluginName)` is called | Notification — allows plugins to reload their config |
| `onBroadcast` | Any time `ctx.broadcast()` is called | Receives all broadcast events |
| `onTaskCreate` | Inside delegation loop — task created | Notification |
| `onTaskComplete` | Inside delegation loop — task validated | Notification (can throw to reject) |
| `onTaskFailed` | Inside delegation loop — max iterations | Notification |

Ask: **Does one of these hooks fire at the right point for what I need?**

If yes -> implement it in a plugin. Do not modify the orchestrator.

### Step 2 — Read the pipeline

File: `apps/orchestrator/src/orchestrator/index.ts`, function `handleMessage` at line 152

The pipeline steps inside handleMessage:
```
Step 0: Thread lookup (sessionId, model, kind, name, customInstructions)    line 158
Step 1: onMessage hooks fire                                                line 166
Step 2: assemblePrompt — adds thread header + kind instruction              line 184
Step 3: onBeforeInvoke chain fires — plugins transform prompt               line 190
Step 4: invoker.invoke(prompt) — Claude is called                           line 214
Step 4b: sessionId persisted if changed (innate)                            lines 224-230
Step 5: onAfterInvoke hooks fire                                            line 233
```

Note: `onPipelineStart` and `onPipelineComplete` fire in `sendToThread` (line 65), which wraps `handleMessage`. The `pipeline:complete` broadcast also fires in `sendToThread` after DB writes (line 118).

Ask: **Is there a pipeline step where this new hook SHOULD fire but currently doesn't?**

If yes -> add a new hook type to `packages/plugin-contract/src/index.ts` and a corresponding call in `orchestrator/index.ts`. This is the ONE valid reason to change the orchestrator.

If no -> the system can already do what you need. Implement it as a plugin.

### Step 3 — Verify the hook is actually called

File: `apps/orchestrator/src/plugin-registry/index.ts`

Plugin registration order (14 plugins):
```
identity, activity, context, discord, web, cron, delegation, validator,
metrics, summarization, auto-namer, audit, time, project
```
(filtered by `PluginConfig.enabled` in DB — plugins can be disabled at runtime without code changes)

Check: Is there a plugin that already implements the hook you need?

If yes and it's not working as expected -> debug the existing plugin, don't add a parallel system.

---

## What PluginContext Provides

Every plugin receives this at `register(ctx)`. Read this before concluding something is unavailable.

File: `packages/plugin-contract/src/index.ts` line 119

```
ctx.db                  — PrismaClient (sandboxed per-plugin unless system: true)
ctx.invoker             — { invoke(prompt, opts), prewarm?(opts) } — call Claude as sub-agent
ctx.config              — { port, claudeModel, claudeTimeout, timezone, maxConcurrentAgents, ... }
ctx.logger              — structured logger
ctx.sendToThread        — run onPipelineStart + handleMessage + onPipelineComplete + persist + broadcast
ctx.broadcast           — fan out an event to all onBroadcast hooks (reaches web browser via web plugin)
ctx.getSettings         — read typed plugin settings from PluginConfig DB records
ctx.notifySettingsChange — trigger onSettingsChange hooks for all plugins
```

A plugin with `ctx.db` + `ctx.sendToThread` + `ctx.broadcast` can do nearly anything.

---

## What the Orchestrator Core Does NOT Own

These are plugin responsibilities, not orchestrator responsibilities:

- **User message persistence** — the web server action persists user messages before calling the orchestrator
- **Rich activity persistence** — pipeline step records, thinking blocks, tool call/result records, pipeline_start/complete markers. Handled by the **activity plugin** via `onPipelineStart` and `onPipelineComplete` hooks.
- **WebSocket delivery** — the web plugin's `onBroadcast` hook. The orchestrator only fires `ctx.broadcast()`.
- **Discord delivery** — the discord plugin handles its own gateway
- **Conversation history injection** — the context plugin's `onBeforeInvoke` injects it into the prompt
- **Token/cost tracking** — the metrics plugin's `onAfterInvoke` records `Metric` rows
- **Sub-agent delegation** — the delegation plugin's `delegate` and `checkin` MCP tools
- **Session pre-warming** — exposed as `ctx.invoker.prewarm()`, called by the web plugin via `POST /api/prewarm`
- **Thread auto-naming** — the auto-namer plugin's `onMessage` hook
- **Conversation summarization** — the summarization plugin's `onAfterInvoke` hook
- **Agent identity/memory** — the identity plugin's `onBeforeInvoke` and `onAfterInvoke` hooks
- **Cron scheduling** — the cron plugin's `start`/`stop` lifecycle

If you are about to add any of these to the orchestrator core, stop and implement a plugin instead.

---

## Common Wrong Conclusions and the Correct Ones

**Wrong:** "The system doesn't handle X, we need to add it to the orchestrator"
**Correct:** Read the full hook list. Which hook fires near the right time? Implement X in a plugin using that hook. If no hook is close, add a new hook type to plugin-contract + one call in handleMessage.

**Wrong:** "handleMessage needs to be modified to support Y"
**Correct:** handleMessage defines pipeline steps. Y is almost certainly a new hook implementation. The only valid reason to change handleMessage is to add a new pipeline step and its corresponding hook.

**Wrong:** "This typing/abstraction looks wrong, we should make it explicit"
**Correct:** Read the actual types in `packages/plugin-contract/src/index.ts`. The abstractions are intentional. If a type looks indirect, it's because it enables plugins to work without coupling to orchestrator internals.

**Wrong:** "We need to revamp the orchestrator to support Z"
**Correct:** The orchestrator is intentionally minimal. Z belongs in a plugin. If you genuinely cannot implement Z as a plugin with the current PluginContext API, add a new method to PluginContext — don't restructure handleMessage.

**Wrong:** "I need to add persistence to sendToThread for feature X"
**Correct:** Persistence is extension behavior. Use `onPipelineStart` or `onPipelineComplete` hooks in a plugin. The activity plugin already demonstrates this pattern — it persists all rich activity records via these hooks.
