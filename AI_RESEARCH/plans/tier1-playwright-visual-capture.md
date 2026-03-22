# Plan: Playwright Visual Capture Pipeline

## What
Extend the existing Playwright plugin so agents can take screenshots/video during validation, and those captures flow back as message attachments visible inline in chat.

## Why
Agents need to show visual proof of what they built/tested. "It works" isn't enough — Quinn wants to see screenshots, watch a video walkthrough, and spot styling issues the agent missed.

## Current State (validated 2026-03-20)

### Playwright plugin (`packages/plugins/playwright/`)
- 8 MCP tools: navigate, snapshot, click, fill, select_option, check, screenshot, press_key
- Per-thread browser sessions with 10-min TTL, swept every 60s
- `browser-manager.ts`: `getPage()` creates `browser.newContext()` then `context.newPage()` — **this is where `recordVideo` goes**
- `screenshot.ts`: saves to `/tmp/harness-playwright/{traceId}/screenshot-{timestamp}.png`, calls `trackFile()`, returns text description
- `temp-tracker.ts`: per-traceId directory cleanup via `cleanupTrace()` on `onPipelineComplete`
- `onPipelineComplete` hook: calls `cleanupTrace(traceId)` + `closePageForThread(threadId)`

### File upload system (`apps/web/`)
- `upload-file.ts` server action: validates MIME (19 types, no video), validates scope/FK, sanitizes filename, writes to `{UPLOAD_DIR}/{scope}/{parentId}/{fileId}-{sanitized}`, creates DB record, broadcasts `file:uploaded`
- `GET /api/files/[id]`: serves file with correct Content-Type, Content-Disposition, Content-Length — **no range request support** (reads entire file into memory)
- File model: `id, name, path (unique), mimeType, size, scope (PROJECT|THREAD|DECORATIVE), extractedText?, projectId?, threadId?, agentId?, messageId?`
- `messageId` FK uses `onDelete: SetNull` — files survive message deletion

### Message rendering (`apps/web/src/app/(chat)/chat/_components/`)
- `message-list.tsx`: server component, queries messages + files, groups files by messageId into Map, passes to MessageItem
- `message-item.tsx`: kind-based routing (12 message types), renders `<MessageFiles files={files} />` below message content
- `message-files.tsx`: renders **all files as chips only** (FileChip + FilePreviewModal on click). No inline media.
- `file-preview-modal.tsx`: 4 preview types — ImagePreview (`<img>`), PdfPreview (`<iframe>`), TextPreview (CodeBlock), DownloadFallback. **No video preview.**
- `file-chip.tsx`: compact badge with icon by MIME type, name, size

### PluginContext (`packages/plugin-contract/src/index.ts`)
- Current methods: `db, invoker, config, logger, sendToThread, broadcast, getSettings, notifySettingsChange, reportStatus, pluginRoutes?`
- **No file-related methods.** `config` includes `uploadDir` (already available).
- `PluginToolMeta`: `{ threadId, taskId?, traceId? }`

### Gap
Screenshots captured to `/tmp/` and auto-deleted. No programmatic upload from plugins. No video capture. No inline media rendering. No video serving with range requests.

---

## Design

### `ctx.uploadFile` on PluginContext (new method)

```typescript
uploadFile: (input: {
  filename: string;
  buffer: Buffer;
  mimeType: string;
  scope: FileScope;
  threadId?: string;
  projectId?: string;
  agentId?: string;
  messageId?: string;
}) => Promise<{ fileId: string; relativePath: string }>;
```

Implementation lives in orchestrator (alongside `sendToThread` construction). Reuses the same path construction + DB insert logic as the web upload action. Broadcasts `file:uploaded` so the web UI updates.

This is the foundation — screenshot tool, video tool, SSH plugin, any future plugin can persist files through one method.

### Screenshot tool changes

Current: saves to `/tmp/`, returns text description, auto-deleted on pipeline complete.

New flow:
1. Take screenshot as now (`page.screenshot()`)
2. Read buffer from disk (or capture to buffer directly)
3. Call `ctx.uploadFile({ filename: 'screenshot-{timestamp}.png', buffer, mimeType: 'image/png', scope: 'THREAD', threadId: meta.threadId })`
4. **Don't** call `trackFile()` — file is now permanent, not temp
5. Return: `"Screenshot saved: screenshot-{timestamp}.png (file ID: {fileId})"`

### Video recording

Playwright records video per BrowserContext, not per page. Two approaches:

**Option A — Context-level recording (simpler):**
- `start_recording` tool: close current page context, create new context with `recordVideo: { dir, size: { width: 1280, height: 720 } }`, navigate to current URL
- `stop_recording` tool: close context (finalizes video), read `.webm` file, call `ctx.uploadFile`, return file ID
- Limitation: can't record selectively, records everything from start to stop

**Option B — Always-record, extract on demand:**
- Always pass `recordVideo` to `newContext()` in `getPage()`
- New `save_recording` tool: closes context to finalize, uploads video, reopens context
- Limitation: closing context loses cookies/state

**Recommendation:** Option A. Explicit start/stop is clearer for agents and avoids always-recording overhead.

### Inline media rendering

Current `MessageFiles` renders all files as chips. New behavior:

```
MessageFiles
  ├─ InlineMediaGallery (images + videos — rendered inline above chips)
  │   ├─ images: CSS grid of <img> thumbnails, click opens FilePreviewModal
  │   └─ videos: <video controls> with poster frame
  └─ FileChip list (non-media files only — PDFs, text, code)
```

Files are split by MIME type:
- `image/*` → inline thumbnail grid
- `video/*` → inline `<video controls>`
- everything else → chip (existing behavior)

### File serving: range request support

`GET /api/files/[id]` needs HTTP 206 for video seeking. Changes:
- Check `Range` header on request
- If present: read partial file, respond with 206 + `Content-Range`
- If absent: serve full file as now (backward compatible)
- Add `Accept-Ranges: bytes` header to all responses
- Stream file from disk instead of reading entire buffer into memory

### Video preview in modal

Add `VideoPreview` component to `file-preview-modal.tsx`:
```tsx
const VideoPreview = ({ file }: { file: FileRecord }) => (
  <video
    src={`/api/files/${file.id}`}
    controls
    className="max-h-[70vh] w-full rounded-lg"
  />
);
```

MIME matching: `file.mimeType.startsWith('video/')` → VideoPreview (before the text fallback check).

---

## Implementation Phases

**All 3 phases COMPLETE (2026-03-20).**

### Phase 1: Screenshot → File Attachment + `ctx.uploadFile` — COMPLETE
**Files to change:**
- `packages/plugin-contract/src/index.ts` — add `uploadFile` to PluginContext type
- `apps/orchestrator/src/orchestrator/index.ts` — implement `uploadFile` closure in PluginContext construction (parallel to `sendToThread`)
- `packages/plugins/playwright/src/_helpers/screenshot.ts` — use `ctx.uploadFile` instead of temp file tracking
- `packages/plugins/playwright/src/index.ts` — pass `ctx` through to screenshot handler
- `apps/web/src/app/(chat)/chat/_actions/upload-file.ts` — add `video/webm`, `video/mp4` to ALLOWED_MIME_TYPES (prep for Phase 2)

**Tests:**
- Unit test for `ctx.uploadFile` (mock fs + db)
- Update screenshot tool tests
- Integration test: screenshot → File record created → servable via GET

### Phase 2: Video Recording + Inline Media Rendering — COMPLETE
**Files to change:**
- `packages/plugins/playwright/src/_helpers/browser-manager.ts` — add recording-aware context creation
- `packages/plugins/playwright/src/index.ts` — add `start_recording` and `stop_recording` tools
- New: `packages/plugins/playwright/src/_helpers/video-recording.ts` — recording state management
- `apps/web/src/app/(chat)/chat/_components/message-files.tsx` — split media files from chip files, render InlineMediaGallery
- New: `apps/web/src/app/(chat)/chat/_components/inline-media-gallery.tsx` — image grid + video player
- `apps/web/src/app/(chat)/chat/_components/file-preview-modal.tsx` — add VideoPreview case
- `apps/web/src/app/api/files/[id]/route.ts` — add range request support (HTTP 206) + streaming

**Tests:**
- Video tool handler tests (start/stop lifecycle)
- InlineMediaGallery component tests (image grid, video player rendering)
- Range request tests on file serving route

### Phase 3: Validation Workflow — COMPLETE
- Composite `playwright__validate_pages` tool: takes URL list, screenshots each, returns all file IDs
- Agent can: navigate → screenshot → record video → all captures appear inline in chat thread
- Consider batch screenshot grid layout for validation review

---

## Dependencies
- File upload system (exists, complete)
- Playwright plugin (exists, complete)
- `OrchestratorConfig.uploadDir` (exists — already in config type)

## Risks
- **Video file size:** Cap at 50MB per recording (configurable via env). Playwright videos at 1280x720 are ~1-2MB/min.
- **Range request complexity:** Need to handle edge cases (invalid ranges, multipart ranges). Use a library or keep it simple (single-range only).
- **Recording state:** If agent forgets to call `stop_recording`, video never finalizes. Add auto-stop on `onPipelineComplete` as safety net.
- **Browser context restart:** `start_recording` must close and recreate the context (Playwright requires `recordVideo` at context creation). This loses cookies/session state — document this for agents.

## Resolved: Open Question
**`ctx.uploadFile` on PluginContext.** Direct DB writes would duplicate path construction, MIME validation, sanitization, and broadcast logic. One method on PluginContext keeps it DRY. The orchestrator already has `config.uploadDir`. Implementation parallels how `sendToThread` wraps the pipeline.
