# Activity Plugin — Developer Notes

## Overview

Implements `onPipelineStart` and `onPipelineComplete` hooks. Reads `src/index.ts` and the four helpers in `src/_helpers/` before editing. This plugin owns all Rich Activity persistence — if you need to add new event types to the activity feed, this is where they go.

---

## Hooks implemented

- **`onPipelineStart(threadId)`** — Fires at the beginning of every pipeline run. Creates one `Message` row: `role='system'`, `kind='status'`, `content='Pipeline started'`, `metadata.event='pipeline_start'`.
- **`onPipelineComplete(threadId, { invokeResult, pipelineSteps, streamEvents })`** — Fires after the pipeline finishes. Persists pipeline steps, all stream events, and a completion status record.

These are not standard plugin-contract hooks — they are custom hooks added specifically to support this plugin. If they are missing from `PluginHooks` in `packages/plugin-contract/src/index.ts`, this plugin won't compile.

---

## What `onPipelineComplete` persists (and in what order)

```
1. persistPipelineSteps  — one Message row per pipeline step name (kind='pipeline_step')
2. persistStreamEvents   — one Message row per stream event (thinking, tool_call, tool_use_summary)
3. persistPipelineComplete — one Message row for completion status with durationMs + token counts
```

The order matters for the UI's chronological activity feed. Steps are written before stream events, and completion is last.

---

## Stream event types

`persistStreamEvents` handles three event types from the `streamEvents[]` array:

| `event.type`      | `kind` written   | Notes |
|-------------------|------------------|-------|
| `thinking`        | `'thinking'`     | Skipped if `event.content` is empty/null |
| `tool_call`       | `'tool_call'`    | Skipped if `event.toolName` is missing. `source` is derived from tool name via `parsePluginSource()` |
| `tool_use_summary`| `'tool_result'`  | Skipped if `event.content` is missing. `metadata.success` is hardcoded `true` |

Events that don't match any of these three types are silently ignored.

---

## `parsePluginSource` and tool name parsing

`parsePluginSource(toolName)` extracts the plugin name from a qualified tool name like `delegation__delegate` → `'delegation'`. If the tool name has no `__` separator, it falls back to `'builtin'`.

This is used to set the `source` column on tool_call messages, which the UI uses to label which plugin the tool came from.

---

## Error handling

Both hook implementations catch all errors and log them — they never propagate. A failure to write a pipeline_start or pipeline_complete record will not stop the orchestrator or affect Claude's response. The UI may show an incomplete activity feed if writes fail, but the conversation continues.

---

## This plugin replaced hardcoded persistence in `sendToThread`

The `data-flow.md` architectural rule document notes that Rich Activity writes (pipeline_start, pipeline_step, thinking, tool_call, tool_result, pipeline_complete) previously lived hardcoded inside `sendToThread` in `apps/orchestrator/src/orchestrator/index.ts`. This plugin is the result of moving them out into the proper extension point.

If you see any of these `kind` values being written directly in `sendToThread`, that is residual technical debt — it belongs here instead.

---

## No `start`, `stop`, or tools

The activity plugin has no lifecycle methods and exposes no MCP tools. It is purely reactive — it only responds to pipeline hook events.
