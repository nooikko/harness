# File Upload System — Design Spec

**Date:** 2026-03-12
**Status:** Draft
**Scope:** Storage backend, database model, context plugin rework, upload/download server actions

---

## Problem

Harness has no file upload infrastructure. Users cannot attach files to projects or threads, upload avatars, or provide reference documents (PDFs, markdown, etc.) for agents to work with. The context plugin currently reads `.md` files from a filesystem directory (`context/`), which has no scoping, no database tracking, and no upload path.

## Goals

1. **Store files on disk** at a configurable path (`UPLOAD_DIR` env var) — local in dev, NFS mount in production.
2. **Track file metadata in the database** — a `File` model with path, MIME type, size, scope, and FK relationships. Metadata is used by the UI for display (icons, sizes, types) and by the context plugin for path resolution.
3. **Rework the context plugin** to inject file path references (not content) from DB records. Claude reads files on demand using its native file-reading capabilities.
4. **Support three scopes:** project-scoped (referenced in agent context), thread-scoped (referenced in agent context), and decorative (stored only — avatars, profile pics).
5. **Broadcast upload events** — emit `file:uploaded`, `file:deleted` events via the existing WebSocket broadcast infrastructure so the UI can show real-time progress and updates.
6. **Context isolation** — files are strictly scoped. A project's files never leak into another project's context. A thread's files never leak into another thread's context. Follows the same isolation pattern as the identity plugin's memory scoping (AGENT/PROJECT/THREAD).

## Non-Goals

- Cloud storage (S3, R2, etc.) — not needed for current deployment model
- File versioning or history
- Inline content injection (Claude reads files on demand via path references)
- Content budgeting or truncation (no file content in the prompt — only paths)
- Text extraction from PDFs/images (Claude reads these natively)
- UI design (handled separately)
- File sharing between projects

---

## Architecture Overview

```
UPLOAD FLOW:
  Browser → Next.js Server Action (upload-file.ts)
    → Write file to UPLOAD_DIR/{scope}/{parentId}/{fileId}-{name}
    → Insert File record in database
    → revalidatePath()

CONTEXT INJECTION FLOW (per message):
  handleMessage pipeline
    → onBeforeInvoke chain
      → identity plugin (soul + memories)
      → context plugin:
          1. Query File records for current project + thread (scope != DECORATIVE)
          2. Resolve full disk paths (UPLOAD_DIR + file.path)
          3. Format as a reference list (name, type, size, path)
          4. Inject reference list alongside project instructions, memory, history
      → time plugin (timestamp)
    → invoke Claude (sees file paths in prompt, reads on demand)

DOWNLOAD/DISPLAY FLOW:
  Browser → Next.js API Route
    → Query File record from DB
    → Read from UPLOAD_DIR + file.path
    → Stream to browser
```

**Key principle:** The orchestrator never handles file bytes. Uploads go through Next.js server actions (same pattern as `send-message.ts`). The context plugin injects file path references (not content) — Claude reads files on demand using its native capabilities (Read tool, Bash, etc.). This means PDFs, images, CSVs, and any file type work immediately with no extraction or content processing.

**Session resumption note:** File reference injection runs unconditionally — it is NOT skipped when `thread.sessionId` exists. The session short-circuit only applies to conversation history (which Claude already has via session resume). File references are not part of the Claude session state, so they must be injected every time.

**Auth note (single-user):** The current deployment is single-user. The file-serving API route does not enforce auth checks. When multi-tenant support is added, auth must be added to `/api/files/[id]` to prevent cross-project file access via ID guessing.

---

## Database Schema

### New Model: File

```prisma
enum FileScope {
  PROJECT
  THREAD
  DECORATIVE
}

model File {
  id            String    @id @default(cuid())
  name          String                          // Original filename (display)
  path          String    @unique               // Relative path within UPLOAD_DIR
  mimeType      String                          // e.g. "text/markdown", "application/pdf"
  size          Int                             // Bytes (max ~2.1GB; sufficient given 10MB upload limit)
  scope         FileScope
  extractedText String?   @db.Text              // Future: text extracted from PDFs etc.

  projectId     String?
  project       Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  threadId      String?
  thread        Thread?   @relation(fields: [threadId], references: [id], onDelete: Cascade)

  agentId       String?
  agent         Agent?    @relation(fields: [agentId], references: [id], onDelete: Cascade)

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([projectId, scope])
  @@index([threadId, scope])
  @@index([agentId, scope])
}
```

### Relation Additions

Add to existing models:

```prisma
model Project {
  // ... existing fields
  files File[]
}

model Thread {
  // ... existing fields
  files File[]
}

model Agent {
  // ... existing fields
  files File[]
}
```

### Scoping Rules

| Scope | Required FK | Other FKs | Injected into context? |
|-------|------------|-----------|----------------------|
| `PROJECT` | `projectId` | null | Yes — for all threads in that project |
| `THREAD` | `threadId` | null | Yes — for that specific thread only |
| `DECORATIVE` | `agentId` | null | No — stored only (avatars, profile pics) |

### Cascade Behavior

- Project deleted → all `PROJECT` and `DECORATIVE` files cascade-deleted from DB
- Thread deleted → all `THREAD` files cascade-deleted from DB
- Agent deleted → all agent `DECORATIVE` files cascade-deleted from DB
- **Disk cleanup on delete:** The `delete-project.ts` and `delete-thread.ts` server actions must query and delete associated disk files BEFORE the DB cascade fires. This prevents orphaned files. A background sweep can catch edge cases (crash between DB delete and disk delete) but is not the primary cleanup mechanism.
- **Incomplete cleanup is acknowledged:** If a disk delete fails after a successful DB delete, the file becomes orphaned on disk. This is an inherent limitation of non-transactional disk+DB operations. A startup sweep of `UPLOAD_DIR` against DB records can catch these rare cases.

---

## Disk Layout

```
$UPLOAD_DIR/
  projects/
    {projectId}/
      {fileId}-{sanitized-name}
  threads/
    {threadId}/
      {fileId}-{sanitized-name}
  agents/
    {agentId}/
      {fileId}-{sanitized-name}
```

- `UPLOAD_DIR` is set via environment variable. Default: `./uploads` (git-ignored in dev).
- `path` column stores the relative path (e.g., `projects/clxyz123/clxyz456-design-spec.md`).
- Full disk path = `join(UPLOAD_DIR, file.path)`.
- Filenames are prefixed with the file ID to prevent collisions.
- Original filename preserved in `file.name` for display.

### Environment Variable

```bash
# .env.example
UPLOAD_DIR="./uploads"    # Local dev (git-ignored)
# Production: UPLOAD_DIR="/mnt/nfs/harness-uploads"
```

### OrchestratorConfig Addition

Add `uploadDir: string` to `OrchestratorConfig` in `packages/plugin-contract/src/index.ts`. The context plugin reads `ctx.config.uploadDir` to construct full disk paths. This keeps the value testable without env var manipulation.

```typescript
// In OrchestratorConfig:
uploadDir: string;  // Resolved from UPLOAD_DIR env var
```

### Scope-to-Folder Mapping

Shared constant (e.g., in a `file-paths.ts` helper) maps enum values to disk folder names:

```typescript
const SCOPE_FOLDERS: Record<FileScope, string> = {
  PROJECT: "projects",
  THREAD: "threads",
  DECORATIVE: "agents",
};
```

Both the upload server action and the context plugin's `loadContextFiles` use this mapping to construct paths. The mapping is defined once and imported by both consumers.

### Startup Health Check

On orchestrator startup, verify `UPLOAD_DIR` exists and is writable. If not, log a warning (not a fatal error — the system can run without file upload support). This surfaces NFS mount issues early in production.

---

## Context Plugin Rework

### Current Behavior (to be replaced)

The context plugin's `onBeforeInvoke` currently:
1. Calls `readContextFiles(contextDir)` — discovers `.md` files from `context/` directory, reads content, caches
2. Calls `formatContextSection(files)` — formats file content as markdown
3. Queries DB for `thread.project.instructions` and `thread.project.memory`
4. Loads conversation history
5. Assembles everything into the prompt

### New Behavior: Reference-Only Injection

Replace step 1-2 with a lightweight DB query that emits file path references. The context plugin never reads file content from disk — Claude reads files on demand.

1. **Query File records** for the current thread's context. The `where` clause is built conditionally — the PROJECT clause is only included when `projectId` is non-null:
   ```typescript
   const conditions: Prisma.FileWhereInput[] = [
     { threadId, scope: 'THREAD' },
   ];
   if (thread.projectId) {
     conditions.push({ projectId: thread.projectId, scope: 'PROJECT' });
   }
   const files = await ctx.db.file.findMany({
     where: { OR: conditions },
     orderBy: { createdAt: 'asc' },
   });
   ```
   When `projectId` is null (thread not in a project), only thread-scoped files are returned. All queries must include a `scope` condition to prevent decorative files from leaking into context results.

2. **Resolve full disk paths** — `join(ctx.config.uploadDir, file.path)` for each record.

3. **Format as a reference section** — a new `formatFileReferences` helper produces a markdown section listing available files with their paths:
   ```markdown
   # Available Files

   ## Project Files
   - design-spec.md (text/markdown, 12KB) → /mnt/uploads/projects/clx123/clx456-design-spec.md
   - insurance-policy.pdf (application/pdf, 2.1MB) → /mnt/uploads/projects/clx123/clx789-insurance-policy.pdf

   ## Thread Files
   - screenshot.png (image/png, 340KB) → /mnt/uploads/threads/clx321/clx654-screenshot.png
   ```

4. Rest of the pipeline unchanged (project instructions, memory, history, summaries).

**Why reference-only:** Claude Code already knows how to read files (Read tool, Bash, etc.). Inlining content wastes context window space for files Claude may not need, and prevents Claude from working with files it needs to edit or navigate. Reference-only means all file types (PDFs, images, CSVs, binaries) work immediately with no extraction or content processing.

### What Gets Removed

- `file-discovery.ts` — filesystem directory walking
- `file-cache.ts` — mtime-based file caching
- `match-pattern.ts` — glob pattern matching
- `default-discovery-config.ts` — include/exclude patterns
- `readContextFiles()` in `file-reader.ts` — no longer reads file content
- `formatContextSection()` — replaced by `formatFileReferences()`
- `maxFileSizeKb` and `contextFileBudgetKb` settings — no content to budget

### What Stays

- `formatHistorySection()` — unchanged
- `formatSummarySection()` — unchanged
- `loadHistory()` — unchanged
- All history/summary logic — unchanged
- Project instructions/memory injection — unchanged

### New Helper: format-file-references.ts

```typescript
type FileReference = {
  name: string;
  mimeType: string;
  size: number;
  fullPath: string;
  scope: FileScope;
};

type FormatFileReferences = (files: FileReference[]) => string;
```

Groups files by scope (Project Files / Thread Files), formats each as a line with name, type, size, and full disk path. Returns empty string if no files. This is a pure formatting function with no I/O.

### New Helper: load-file-references.ts

```typescript
type LoadFileReferences = (
  db: PrismaClient,
  uploadDir: string,
  threadId: string,
  projectId: string | null,
) => Promise<FileReference[]>;
```

Queries the DB for scoped files, resolves full disk paths, returns `FileReference[]`. No disk reads — just a DB query and path resolution.

**Caller responsibility:** The `onBeforeInvoke` hook already queries the thread record to get `sessionId` and `project`. It passes the already-resolved `threadId` and `projectId` to `loadFileReferences` — no second DB query needed.

---

## Upload Server Action

### Location

`apps/web/src/app/(chat)/chat/_actions/upload-file.ts`

### Interface

```typescript
type UploadFileInput = {
  file: File;                       // Web API File object
  scope: FileScope;
  projectId?: string;               // Required when scope = PROJECT
  threadId?: string;                 // Required when scope = THREAD
  agentId?: string;                  // Required when scope = DECORATIVE (agent avatar)
};
```

### Flow

1. **Validate** — check scope/FK consistency, file size limit (10MB default), MIME type allowlist.
2. **Generate path** — `{scope}/{parentId}/{cuid()}-{sanitized-filename}`.
3. **Write to disk** — `mkdir -p` the parent directory, write the file buffer.
4. **Insert DB record** — `prisma.file.create(...)`.
5. **Revalidate** — `revalidatePath` for the parent page.
6. **Return** — the created `File` record.

### Validation Rules

- Max file size: **10MB** (configurable via env var `MAX_FILE_SIZE_MB`).
- MIME type allowlist: `text/*`, `application/pdf`, `application/json`, `application/xml`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`.
- Scope/FK validation: PROJECT requires projectId, THREAD requires threadId, DECORATIVE requires agentId.
- Filename sanitization: strip path traversal, control characters, limit length.

### Error Handling

- File too large → return error, no disk write
- Invalid MIME type → return error, no disk write
- Disk write fails → return error, no DB record
- DB insert fails → delete file from disk (cleanup), return error

---

## Delete Server Action

### Location

`apps/web/src/app/(chat)/chat/_actions/delete-file.ts`

### Flow

1. **Query** the File record (get `path` for disk location).
2. **Delete from disk** — `fs.unlink(join(UPLOAD_DIR, file.path))`. Log warning if file already missing.
3. **Delete DB record** — `prisma.file.delete(...)`.
4. **Revalidate** — `revalidatePath` for the parent page.

**Order matters:** Disk delete before DB delete. If disk delete fails, the DB record still exists and the user can retry. If we reversed the order (DB first, then disk), a failed disk delete would orphan the file with no DB record to reference it.

---

## Serving Files (Download/Display)

### API Route

`apps/web/src/app/api/files/[id]/route.ts`

- Queries `File` record by ID.
- Reads from `UPLOAD_DIR + file.path`.
- Returns with correct `Content-Type` header.
- Supports `Content-Disposition: attachment` for downloads.
- Supports `If-None-Match` / ETag for caching.

---

## Real-Time Broadcast Events

File operations emit events through the existing `ctx.broadcast()` → WebSocket infrastructure. The upload/delete server actions call `fetch POST /api/broadcast` (or a shared helper) to notify the orchestrator, which fans out via the web plugin's `onBroadcast` handler — the same path used by `pipeline:complete`, `thread:name-updated`, etc.

### Events

| Event | Payload | When |
|-------|---------|------|
| `file:uploaded` | `{ fileId, name, scope, projectId?, threadId?, agentId?, mimeType, size }` | After successful upload (disk write + DB insert) |
| `file:deleted` | `{ fileId, name, scope, projectId?, threadId?, agentId? }` | After successful delete (disk + DB) |
| `file:upload-failed` | `{ name, error, scope, projectId?, threadId? }` | On validation or write failure |

These events enable the UI to:
- Show real-time file list updates without page refresh
- Display upload progress/completion notifications
- Update file counts in sidebar/project views

When text extraction is added later, additional events (`file:extraction-started`, `file:extraction-complete`) can follow the same pattern.

---

## Context Isolation

File injection follows strict scope isolation — the same pattern used by the identity plugin's memory scoping (AGENT/PROJECT/THREAD).

### Isolation Rules

```
Thread in Project A:
  ✓ Gets PROJECT files where projectId = A
  ✓ Gets THREAD files where threadId = this thread
  ✗ Cannot see PROJECT files from Project B
  ✗ Cannot see THREAD files from other threads
  ✗ Cannot see DECORATIVE files (any scope)

Thread with no project:
  ✓ Gets THREAD files where threadId = this thread
  ✗ Cannot see any PROJECT files
  ✗ Cannot see DECORATIVE files

Delegated sub-thread (same project):
  ✓ Gets PROJECT files from parent's project (via inherited projectId)
  ✓ Gets its own THREAD files only (not parent's THREAD files)

Cron-created thread:
  ✓ Gets PROJECT files from CronJob's project (via inherited projectId)
  ✓ Gets its own THREAD files only
```

### Enforcement

Isolation is enforced at the query level in `loadContextFiles`. The `where` clause explicitly names which scopes to include:

```typescript
const conditions: Prisma.FileWhereInput[] = [
  { threadId, scope: 'THREAD' },
];
if (projectId) {
  conditions.push({ projectId, scope: 'PROJECT' });
}
// DECORATIVE is never included — no condition matches it
```

There is no "get all files" query path. Every consumer must specify scope conditions. The `@@index([projectId, scope])` and `@@index([threadId, scope])` indexes ensure these scoped queries are efficient.

---

## Plugin Interaction Summary

| Plugin | Interaction with files | Changes needed |
|--------|----------------------|----------------|
| **context** | Queries File records, injects path references into prompt (no content reading) | Major: replace filesystem discovery with DB query + path formatting |
| **identity** | None — soul/memory injection is independent of files | None |
| **activity** | None — activity records don't reference files | None |
| **project** | None — `get/set_project_memory` is text-only | None |
| **web** | None — uploads go through Next.js, not the orchestrator HTTP server | None |
| **metrics** | None | None |
| **delegation** | None — delegated threads inherit project, so they get project files automatically | None |
| **cron** | None — cron threads inherit project, so they get project files automatically | None |
| **summarization** | None | None |
| **auto-namer** | None | None |
| **audit** | None — audit extracts messages, not files | None |
| **time** | None | None |
| **discord** | None | None |
| **validator** | None | None |

**Only the context plugin changes.** All other plugins are unaffected because files flow through the existing `onBeforeInvoke` chain — Claude sees file content as part of the prompt, which is already how everything works.

---

## Precursors & Sibling Work

### Precursors (must happen before or during file upload work)

1. **`UPLOAD_DIR` environment setup** — add to `.env.example`, add `uploads/` to `.gitignore`, document in CLAUDE.md.
2. **Prisma schema migration** — add `File` model, `FileScope` enum, relation fields on Project/Thread/Agent. Run `db:push` or create migration.

### Sibling Work (not blockers, but natural to do together)

3. **`/chat/projects` list page** — the sidebar "Projects" link currently 404s. This is a natural place to show project files, but file uploads don't depend on it.
4. **Project detail page file section** — add a file list + upload UI to the existing `/chat/projects/[id]` settings page. This is the primary upload surface for project-scoped files.
5. **Thread file attachment** — add file upload to the chat input or a thread settings modal. Can be done after the core upload infrastructure.
6. **Agent avatar upload** — add image upload to the agent edit form. Uses `DECORATIVE` scope.

### Future Work (explicitly deferred)

7. **Text extraction** — `extractedText` field is ready. When built, populate it at upload time for PDFs/images. The context plugin already checks for it.
8. **Orphan cleanup job** — cron job or manual helper that sweeps `UPLOAD_DIR` for files without DB records.
9. **File search** — search across uploaded file content (requires extraction first for non-text files).

---

## Implementation Order

```
Phase 1: Foundation
  1. Schema: File model + FileScope enum + relations
  2. Environment: UPLOAD_DIR env var + .gitignore
  3. Server actions: upload-file.ts + delete-file.ts
  4. API route: /api/files/[id]/route.ts (serve files)
  5. Tests for all above

Phase 2: Context Plugin Rework
  6. New helper: load-context-files.ts (DB query + disk read)
  7. Replace readContextFiles() call in onBeforeInvoke
  8. Remove filesystem discovery code
  9. Update context plugin tests (~85 tests to rework)
  10. Integration test: upload file → send message → verify file content in prompt

Phase 3: UI Integration (separate spec)
  11. Project settings page: file list + upload
  12. Thread: file attachment
  13. Agent: avatar upload
```

Phases 1 and 2 are this spec. Phase 3 is separate UI work.

---

## Testing Strategy

### Unit Tests

| Component | Tests |
|-----------|-------|
| `upload-file.ts` server action | Validation (size, MIME, scope/FK), disk write, DB insert, error rollback |
| `delete-file.ts` server action | DB delete, disk cleanup, missing file handling |
| `load-file-references.ts` helper | DB query by scope, path resolution, scope filtering |
| `format-file-references.ts` helper | Grouping by scope, formatting output, empty file list |
| `/api/files/[id]` route | Serve file, 404 handling, content-type headers |
| Context plugin `onBeforeInvoke` | File reference injection alongside history/instructions, empty file list |

### Integration Tests

| Scenario | Validates |
|----------|----------|
| Upload → query → verify DB record + disk file | End-to-end upload |
| Upload → send message → check prompt contains file path references | Context injection |
| Delete project → verify files cascade-deleted from DB + disk cleanup | Cascade behavior |
| Upload with wrong scope/FK → verify validation rejects | Scope enforcement |

---

## Resolved Questions

1. **Thread-scoped files persist across summarization.** Summarization compresses message history but doesn't touch files. File path references remain available in context after summarization. No change needed.

2. **Project files auto-propagate to delegated sub-agents.** Child threads in the same project see project-scoped files automatically via shared `projectId`. This is the desired default. Can be revisited if explicit control is needed later.

3. **No file count limit per project/thread.** Since only path references are injected (not content), each file adds roughly one line to the prompt. Even 100 files would be negligible overhead. Revisit if needed.

4. **`ContextPluginOptions` deleted.** The `createContextPlugin(options)` factory and all filesystem-specific options (`contextDir`, `fileDiscovery`, `maxFileSize`, `priorityFiles`) are removed. The context plugin becomes a plain `PluginDefinition` export like all other plugins. Tests use the `plugin` export directly and mock the DB.

5. **`extractedText` field kept as placeholder.** Claude reads files natively, so text extraction is not needed now. The nullable field stays in the schema as a future extension point for search/indexing. Costs nothing.
