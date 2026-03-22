# Content Block System

**Status:** Phase 1 + Phase 2 complete (framework + 4 block types)
**Date:** 2026-03-17

## Overview

A generic content block framework that allows MCP tools to return structured data alongside their text response. The frontend has a registry of block renderers that map block types to React components for rich, interactive display instead of raw `<pre>` blocks.

## Architecture

```
Tool handler returns { text, blocks }
         │
         ▼
Tool server sends `text` to Claude, pushes `blocks` to contextRef.pendingBlocks queue
         │
         ▼
Orchestrator's onMessage callback pops blocks from queue for tool_use_summary events
         │
         ▼
Activity plugin persists blocks in message metadata
         │
         ▼
Frontend tool-result-block checks metadata.blocks → registry lookup → render component
```

## What Was Built

### Backend (Plugin Contract + Tool Server + Orchestrator)

- `ContentBlock` type: `{ type: string; data: Record<string, unknown> }`
- `ToolResult` type: `string | { text: string; blocks: ContentBlock[] }`
- `PluginToolHandler` return type updated to `Promise<ToolResult>` (backward compatible)
- `InvokeStreamEvent.blocks` optional field added
- `ToolContextRef.pendingBlocks` queue (FIFO array of ContentBlock[][])
- Tool server normalizes structured returns: text → SDK, blocks → queue
- Orchestrator's `consumeToolBlocks` callback enriches `tool_use_summary` events
- Activity plugin persists `blocks` in tool_result message metadata

### Frontend (Content Block Registry + 4 Block Types)

- **Registry** (`content-blocks/registry.tsx`): Maps block `type` → lazy-loaded React component
- **tool-result-block.tsx**: Checks `metadata.blocks`, routes to registry, falls back to `<pre>`
- **email-list-block**: Email cards with sender avatar, subject, preview, expandable body, "Open in Outlook" link
- **map-block**: Google Maps embed (with allowlisted domains) or placeholder with "Open in Maps" link
- **timer-block**: Countdown/stopwatch with start/pause/reset controls, progress bar
- **recipe-block**: Title, servings, prep/cook time, checkable ingredients, numbered steps

## How to Add a New Block Type

1. Create `apps/web/src/app/(chat)/chat/_components/content-blocks/my-block.tsx` with default export
2. Add to registry: `const MyBlock = lazy(() => import('./my-block'));` + `"my-type": MyBlock`
3. Have your plugin tool handler return: `{ text: "...", blocks: [{ type: "my-type", data: {...} }] }`

No backend changes needed — the framework handles everything.

## How to Wire an Existing Tool

Change the tool handler from returning a string to returning a `ToolResult`:

```typescript
// Before
return formatMarkdownTable(emails);

// After
return {
  text: formatMarkdownTable(emails),  // Claude still sees this
  blocks: [{ type: "email-list", data: { emails: emails.map(toSummary) } }]
};
```

## Key Files

| File | What it owns |
|------|-------------|
| `packages/plugin-contract/src/index.ts` | `ContentBlock`, `ToolResult`, `PluginToolHandler` types |
| `apps/orchestrator/src/tool-server/index.ts` | Structured return handling, `pendingBlocks` queue |
| `apps/orchestrator/src/orchestrator/index.ts` | `consumeToolBlocks` wiring in handleMessage |
| `apps/orchestrator/src/index.ts` | Boot-time wiring of `consumeToolBlocks` |
| `packages/plugins/activity/src/_helpers/persist-stream-events.ts` | Persists blocks in metadata |
| `apps/web/.../tool-result-block.tsx` | Routes to block registry |
| `apps/web/.../content-blocks/registry.tsx` | Type → component map |
| `apps/web/.../content-blocks/email-list-block.tsx` | Email list renderer |
| `apps/web/.../content-blocks/map-block.tsx` | Map embed renderer |
| `apps/web/.../content-blocks/timer-block.tsx` | Timer widget |
| `apps/web/.../content-blocks/recipe-block.tsx` | Recipe card |

## Future Work

- Wire Outlook plugin to return `email-list` blocks
- Wire Calendar plugin to return `calendar-events` blocks
- Add DOMPurify for safe HTML email body rendering (currently strips to plain text)
- Add more block types: `calendar-events`, `task-list`, `file-list`, `contact-card`
- Consider Google Maps API key for embedded map rendering
