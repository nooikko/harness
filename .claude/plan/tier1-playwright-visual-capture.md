# Plan: Playwright Visual Capture Pipeline

## What
Extend the existing Playwright plugin so agents can take screenshots/video during validation, and those captures flow back as message attachments visible in chat.

## Why
Agents need to show visual proof of what they built/tested. "It works" isn't enough — Quinn wants to see screenshots, watch a video walkthrough, and spot styling issues the agent missed.

## Current State

### What exists (Playwright plugin)
- 8 MCP tools: navigate, snapshot, click, fill, select, check, screenshot, press_key
- Per-thread browser sessions with 10-min TTL
- Screenshot tool saves to `/tmp/harness-playwright/{traceId}/screenshot-{timestamp}.png`
- Auto-cleanup at `onPipelineComplete`
- No video capture

### What exists (File uploads)
- Complete upload pipeline: API route, server action, DB model, chat UI display
- File preview modal supports images (native img), PDFs (iframe), text (syntax highlight)
- Context plugin injects file references into prompts
- **But:** Uploads only come from browser UI (user clicking paperclip). No programmatic upload path for agents.

### Gap
Screenshots are captured to `/tmp/` and cleaned up. They never reach the File table or chat UI.

## Design

### Bridge: Agent Screenshot → Message Attachment
The `screenshot` tool currently returns a temp file path as text. Instead:

1. Screenshot tool saves to disk (as now)
2. Tool handler also calls `uploadFile` server action equivalent (or direct DB + disk write)
3. File record created with `scope: THREAD`, `threadId` from meta, `messageId` null (attached to thread, not a specific message)
4. Tool returns both the file ID and a confirmation: "Screenshot saved: {filename} (attached to thread)"
5. When the agent's response is persisted as a message, the file can be linked via `messageId` update

### New: Video Capture
Playwright supports video recording per page:
```typescript
const page = await browser.newPage({
  recordVideo: { dir: '/tmp/harness-playwright/videos/', size: { width: 1280, height: 720 } }
});
```

New MCP tool: `playwright__start_recording` / `playwright__stop_recording`
- Start: enables video recording on the current page
- Stop: finalizes video, uploads as file attachment, returns file ID
- Video format: WebM (Playwright default)

### File Preview Enhancement
- Add video player to `file-preview-modal.tsx` for `video/webm` MIME type
- Simple `<video>` element with controls

## Implementation Phases

### Phase 1: Screenshot → File Attachment
- Modify `screenshot` tool handler to persist captures as File records
- Add programmatic upload helper (reuse `uploadFile` logic but callable from plugin context)
- Skip temp file cleanup for persisted screenshots
- Update tool response to include file info

### Phase 2: Video Recording
- Add `start_recording` and `stop_recording` tools
- Video saves to upload dir, creates File record
- Add video player to file preview modal
- Add `video/webm` to allowed MIME types

### Phase 3: Validation Workflow
- Agent can: navigate to staging URL → take screenshots of key pages → record video walkthrough → all captures appear in chat thread
- Consider a composite tool: `playwright__validate_pages` that takes a list of URLs, screenshots each, returns all file IDs

## Dependencies
- File upload system (exists, complete)
- Playwright plugin (exists, complete)
- Need programmatic file upload from plugin context (new helper)

## Risks
- **Video file size:** Screen recordings can be large. Need size limits and duration caps.
- **Upload dir permissions:** Orchestrator process needs write access to `UPLOAD_DIR` (already checked at startup).
- **Browser resource usage:** Video recording increases memory. May need to limit concurrent recordings.

## Open Question
Should `PluginContext` get a `uploadFile` method? Or should plugins use `ctx.db` directly to create File records + write to disk? The latter is simpler but duplicates upload logic. A `ctx.uploadFile` method would be cleaner and reusable across plugins.
