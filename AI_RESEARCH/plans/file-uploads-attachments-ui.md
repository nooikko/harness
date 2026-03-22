# Plan: File Attachments UI

## Summary

Build the UI layer for the already-complete file upload backend. The `File` model, upload server action, delete server action, serving API route, and context plugin injection are all implemented and tested. This plan is **purely frontend work**: attachment button in chat input, thread attachments panel, and multi-format file preview.

## Current State

**Already exists:**
- `File` model in Prisma with `name`, `path`, `mimeType`, `size`, `scope` (PROJECT/THREAD/DECORATIVE), `extractedText`, FK to project/thread/agent
- `GET /api/files/[id]` route that serves files from disk with proper Content-Type
- `FileScope` enum (PROJECT, THREAD, DECORATIVE)
- `UPLOAD_DIR` env var for file storage path
- **Upload server action** `apps/web/src/app/(chat)/chat/_actions/upload-file.ts` — handles file validation (size + MIME whitelist), sanitized filenames, disk write, DB record creation, orchestrator notification
- **Delete server action** `apps/web/src/app/(chat)/chat/_actions/delete-file.ts` — disk delete + DB delete
- **Context plugin integration** — `loadFileReferences` injects thread/project files into prompts unconditionally

**Missing:**
- Upload button in chat input area (the server action exists but no UI triggers it)
- Thread attachments panel (Claude-style paperclip button in thread header)
- File preview components (image, PDF, text, code)
- Message-to-file linking (which message included a file upload)

## Schema Changes

```prisma
// Add to Message model — link files to the message they were uploaded with
model Message {
  // ... existing fields
  fileIds   String[]  // Array of File IDs attached to this message
}

// Add messageId to File for reverse lookup
model File {
  // ... existing fields
  messageId String?
  // No FK — just a loose reference for provenance tracking
}
```

## API: Upload Route

### `POST /api/files`

```typescript
// apps/web/src/app/api/files/route.ts
// Accepts: multipart/form-data
// Fields: file (binary), threadId (string), scope (string, default "THREAD")
// Returns: { id, name, mimeType, size, path }

// Implementation:
// 1. Parse multipart form data (use Next.js built-in request.formData())
// 2. Validate file size (max 25MB)
// 3. Validate mime type (allowlist: images, PDFs, text, code, archives)
// 4. Generate unique filename: `${cuid()}-${sanitize(originalName)}`
// 5. Write to UPLOAD_DIR/threads/<threadId>/ (organized by thread)
// 6. Extract text for searchable types (PDF via pdf-parse, text/code as-is)
// 7. Create File record in DB
// 8. Return file metadata
```

### Allowed MIME Types

```
image/*
application/pdf
text/plain, text/markdown, text/csv, text/html
application/json
application/javascript, application/typescript (custom)
application/zip, application/gzip
```

## UI Components

### 1. Upload Button in Chat Input

Add a paperclip/attachment icon button to the left of the chat input textarea (like Claude's "+" button).

**File:** `apps/web/src/app/(chat)/chat/_components/chat-input.tsx` (modify)

- Click opens native file picker
- Drag-and-drop support on the input area
- Selected files show as preview chips below the input (filename + X to remove)
- On send: upload files first via `POST /api/files`, then include `fileIds` in the message

### 2. Thread Attachments Panel

**Button:** Paperclip icon in the thread header bar (top right area).
**Panel:** Slide-over panel from the right showing all files for this thread.

**File:** `apps/web/src/app/(chat)/chat/_components/thread-attachments-panel.tsx` (create)

```
┌─────────────────────────┐
│ Attachments (12)     ✕  │
│─────────────────────────│
│ 📄 report.pdf    1.2MB │
│ 🖼️ screenshot.png 340KB│
│ 📝 notes.md       12KB │
│ ...                     │
└─────────────────────────┘
```

- Click on a file → opens preview modal
- Files grouped by type (images, documents, other)
- Shows upload date and which message it came from (click to scroll to message)

### 3. File Preview Modal

**File:** `apps/web/src/app/(chat)/chat/_components/file-preview-modal.tsx` (create)

Uses Dialog from `@harness/ui`. Preview strategy by type:

| MIME Type | Preview Strategy |
|-----------|-----------------|
| `image/*` | Native `<img>` tag with zoom/pan |
| `application/pdf` | `<iframe>` with PDF.js or browser native viewer |
| `text/*`, `application/json` | Syntax-highlighted code view (use existing `react-markdown` or add `prism-react-renderer`) |
| `application/javascript` | Syntax-highlighted with language detection |
| Other | Download link + file info card |

### 4. Inline File References in Messages

When a message has `fileIds`, show small file chips below the message text:

```
┌────────────────────────────────────┐
│ Here's the report you asked for    │
│                                    │
│ 📎 quarterly-report.pdf  (1.2MB)  │
│ 📎 summary-chart.png     (340KB)  │
└────────────────────────────────────┘
```

Click chip → opens preview modal.

## Implementation Steps

### Step 1: Schema Migration
- Add `fileIds String[]` to Message model
- Add `messageId String?` to File model
- Run migration

### Step 2: Chat Input Upload (upload server action already exists)
- Add attachment button to chat input
- File picker + drag-and-drop
- Preview chips for selected files
- Upload on send, link to message

### Step 4: Thread Attachments Panel
- Fetch files for thread
- Slide-over panel with file list
- Group by type
- Click to preview

### Step 5: File Preview Modal
- Image preview (with zoom)
- PDF preview (iframe)
- Text/code preview (syntax highlighting)
- Fallback download card

### Step 6: Message File Chips
- Render file chips below messages with fileIds
- Click to open preview

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `packages/database/prisma/schema.prisma` | Modify | Add fileIds to Message, messageId to File |
| `apps/web/src/app/api/files/route.ts` | Create | Upload endpoint |
| `apps/web/src/app/(chat)/chat/_components/chat-input.tsx` | Modify | Add attachment button |
| `apps/web/src/app/(chat)/chat/_components/thread-attachments-panel.tsx` | Create | Attachments slide-over |
| `apps/web/src/app/(chat)/chat/_components/file-preview-modal.tsx` | Create | Multi-format file preview |
| `apps/web/src/app/(chat)/chat/_components/file-chip.tsx` | Create | Inline file reference chip |
| `apps/web/src/app/(chat)/chat/_components/message-item.tsx` | Modify | Render file chips for messages |

## Dependencies

```json
{
  "pdf-parse": "^1.1.1",
  "prism-react-renderer": "^2.0.0"
}
```

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Large file uploads blocking UI | Stream upload with progress bar, 25MB limit |
| Disk storage filling up | Add UPLOAD_MAX_TOTAL_SIZE env var, warn at 80% |
| PDF text extraction failures | Graceful fallback — store file without extractedText |
| Image preview memory on large files | Generate thumbnails on upload for list views |
