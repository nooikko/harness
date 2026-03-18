---
name: bug-hunt
description: Plugin-focused logic bug hunter — cross-references plugin code against the contract and pipeline rules to find where things break
argument-hint: "<plugin-name>"
disable-model-invocation: true
---

# Plugin Bug Hunt

**Mission**: Adversarial plugin auditor. Read the contract fresh, read the plugin code, find where things break. You are hunting logic bugs, not style issues.

---

## Critical Constraints

1. **READ-ONLY TOOLS ONLY**: You may ONLY use `Read`, `Grep`, `Glob`, and `Bash` (for `git` only)
   - **NEVER** use `Write`, `Edit`, or any modification tools
   - You OBSERVE and REPORT — you do NOT fix

2. **READ THE CONTRACT FRESH**: Do NOT rely on cached knowledge of the plugin contract or pipeline.
   Read the actual source files listed in Phase 1 every single time.

3. **ADVERSARIAL MINDSET**: Assume the plugin has bugs until proven otherwise.
   Focus on what breaks, not what works.

4. **LOGIC BUGS ONLY**: Do not flag style, naming, formatting, or documentation issues.
   This is not a code review. This is a bug hunt.

---

## Phase 0: Plugin Resolution

Resolve `$ARGUMENTS` to a plugin directory:

1. Check `packages/plugins/$ARGUMENTS/src/index.ts` — if it exists, use it
2. If not found, glob `packages/plugins/*/src/index.ts` and grep for a plugin with a matching `name` field
3. If still not found, fail with: "Plugin not found. Available plugins:" and list all directories under `packages/plugins/`

Once resolved, read the plugin's `index.ts` and identify:
- Which hooks are implemented (onMessage, onBeforeInvoke, onAfterInvoke, onPipelineStart, onPipelineComplete, onBroadcast, onSettingsChange, onTaskCreate, onTaskComplete, onTaskFailed)
- Which MCP tools are defined (name, schema, handler)
- Whether `start()` / `stop()` lifecycle methods exist
- Whether `system: true` is set
- Whether `settingsSchema` is defined

---

## Phase 1: Contract Compliance

**Read these files fresh** (do not skip this step):

1. `packages/plugin-contract/src/index.ts` — full contract types
2. `packages/plugin-contract/src/_helpers/run-hook.ts` — notification hook runner
3. `packages/plugin-contract/src/_helpers/run-chain-hook.ts` — chain hook runner
4. `apps/orchestrator/src/plugin-registry/index.ts` — registration order
5. `apps/orchestrator/src/orchestrator/index.ts` — the pipeline (handleMessage + sendToThread)

Then check every applicable item:

| # | Check | What to Verify |
|---|-------|----------------|
| 1 | **Hook signatures** | Every hook implementation matches the exact signature in `PluginHooks`. Pay special attention to `onBeforeInvoke` returning `Promise<string>` and `onPipelineComplete` receiving the full result object. |
| 2 | **Chain hook return guarantee** | If `onBeforeInvoke` is implemented, does EVERY code path return a string? Including catch blocks, early returns, and conditional branches. A path that returns `undefined` silently drops the prompt. |
| 3 | **sendToThread in register()** | `ctx.sendToThread` calls `handleMessage`, which is only assigned after all plugins register. Calling it in `register()` will throw. Only safe in `start()`, hooks, or tool handlers. |
| 4 | **Hook ordering assumptions** | Does this plugin read data that another plugin should have injected? Check the `ALL_PLUGINS` array in `plugin-registry/index.ts`. Identity runs before context, context before time. If this plugin assumes data from a later plugin, it will get stale/missing data. |
| 5 | **DB writes in wrong phase** | `onPipelineComplete` fires BEFORE the orchestrator writes the assistant text message (the innate write in `sendToThread`). A plugin querying for the assistant message in `onPipelineComplete` will NOT find it. |
| 6 | **Tool handler meta safety** | Tool handlers receive `meta: PluginToolMeta`. `threadId` is required but `taskId` and `traceId` may be undefined. Does the handler use optional fields without null checks? |
| 7 | **Runtime disable degradation** | Plugins can be disabled via `PluginConfig.enabled` in the DB. If this plugin is disabled, do other plugins or the web UI that depend on its DB records, broadcast events, or tool availability degrade gracefully? |
| 8 | **Fire-and-forget error swallowing** | `void asyncFn()` discards the promise. If the async function throws, the error is silently lost. Look for `void` calls — should they at minimum catch and log? Pattern: `void fn().catch(err => ctx.logger.error(...))`. |
| 9 | **Tool return type** | Tool handlers must return `string` or the structured `ToolResult` type. Does the handler return the correct type on ALL paths, including error paths? |
| 10 | **Settings schema usage** | If the plugin defines `settingsSchema`, does it call `ctx.getSettings()` with its own schema? Does `onSettingsChange` properly reload when settings are updated? |

---

## Phase 2: Logic Tracing

Read every file in the plugin's `src/` directory — `index.ts` and all files in `_helpers/`. For each, trace data flow and check:

| # | Check | What to Verify |
|---|-------|----------------|
| 1 | **Null agentId path** | If the plugin reads `thread.agentId`, what happens when it is null? Many threads have no agent. Does the code early-return gracefully or crash? Also check `thread.agent` (the relation, may not be included in the query). |
| 2 | **Empty DB query results** | Every `findUnique`, `findFirst`, `findMany` can return null or empty. Check: `thread.project` (nullable FK), `agent.config` (optional relation), `thread.agent` (optional). Does the code handle all null cases? |
| 3 | **Read-then-write atomicity** | Pattern: `const x = await db.model.findFirst(...)` then later `await db.model.update({ where: { id: x.id } })`. Between those two calls, another concurrent pipeline run could modify or delete the same record. Should this be a `db.$transaction()`? |
| 4 | **Fire-and-forget race conditions** | If a hook launches a background task (e.g., `void scoreMemory()`), and the next message arrives before it completes, can the two instances conflict? Look for: shared mutable state, duplicate DB writes, counter increments, or reads of not-yet-written data. |
| 5 | **Cross-plugin data coupling** | Does this plugin query DB tables or records that another plugin owns? Examples: querying `Message` records with `kind: 'status'` (owned by activity plugin), reading `AgentMemory` (owned by identity plugin). Not always a bug, but flag as coupling. |
| 6 | **Broadcast event contracts** | If the plugin calls `ctx.broadcast(event, data)`, does the data shape match what consumers expect? Grep for the event name in `packages/plugins/web/src/` and `apps/web/src/` to find consumers and verify the contract. |
| 7 | **Error isolation impact** | `run-hook.ts` catches errors per-plugin. But for `onBeforeInvoke` (chain hook), an error means this plugin's transformation is silently skipped — the chain continues with the previous value. Could the prompt reach Claude in a broken or incomplete state if this plugin's transform is skipped? |
| 8 | **Unbounded queries** | `findMany()` without `take` can return thousands of records. Check for unbounded queries, especially in tool handlers (called during Claude invocation, adding latency) and in hooks that run on every message. |
| 9 | **Hardcoded model references** | Does the plugin hardcode a model name (e.g., `claude-haiku-4-5-20251001`)? Model names change across versions. Should it use `ctx.config.claudeModel` or a settings-driven value instead? |
| 10 | **Timeout and error handling on invoke** | If the plugin calls `ctx.invoker.invoke()`, does it handle: timeout (long-running invocation), empty response (model returned nothing), error/throw (SDK failure)? An unhandled invoke error in a fire-and-forget path is silently lost. |

---

## Phase 3: Generate Findings

For EACH issue found, create a structured finding:

```
### [{SEVERITY}] {Short Title}

**File:** `{path/to/file.ts}`
**Category:** {contract-violation|null-path|race-condition|cross-coupling}

**Problem:**
{What is wrong — be specific about the code path}

**Impact:**
{What breaks, under what conditions, how likely is it}

**Evidence:**
```{language}
{The relevant code snippet}
```
```

### Severity Definitions

- **CRITICAL**: Will break the pipeline, lose data, or cause undefined behavior in realistic conditions
- **MAJOR**: Will fail under specific but realistic conditions (null agent, disabled plugin, concurrent messages, empty DB)
- **MINOR**: Defensive gap, missing error log, hardcoded value, undocumented coupling

---

## Phase 4: Summary Report

```
# Bug Hunt Report: {plugin-name} plugin

## Plugin Profile
- Name: {name}
- Version: {version}
- Hooks: {list}
- Tools: {list or "none"}
- Lifecycle: {start/stop or "none"}
- Position in ALL_PLUGINS: {N of M} (runs after: {prev}, before: {next})

## Findings Summary

| Category              | Critical | Major | Minor |
|-----------------------|----------|-------|-------|
| Contract Violations   | {n}      | {n}   | {n}   |
| Null/Missing Data     | {n}      | {n}   | {n}   |
| Race Conditions       | {n}      | {n}   | {n}   |
| Cross-Plugin Coupling | {n}      | {n}   | {n}   |

## Top Issues (Prioritized)

1. [{severity}] {title} — {file}
2. [{severity}] {title} — {file}
3. ...

## Detailed Findings

{All findings from Phase 3, grouped by category}
```

---

## What NOT to Do

- **DO NOT** fix code — only report findings
- **DO NOT** skip the contract read — read it fresh every invocation
- **DO NOT** assume hook behavior from memory — verify against the actual runner source
- **DO NOT** flag style issues — this is a logic bug hunt, not a code review
- **DO NOT** praise working code — focus exclusively on what can break
- **DO NOT** flag issues in test files — only audit production source code

---

## Review Target

$ARGUMENTS
