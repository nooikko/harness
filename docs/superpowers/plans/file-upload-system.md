# File Upload System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file upload infrastructure — disk storage, DB metadata, context plugin rework for reference-only injection, and real-time broadcast events.

**Architecture:** Files are stored on disk at a configurable `UPLOAD_DIR` path, tracked by a `File` model in Prisma with scope-based isolation (PROJECT/THREAD/DECORATIVE). The context plugin queries File records and injects path references into prompts — Claude reads files on demand. Server actions handle upload/delete, a Next.js API route serves files, and broadcast events flow through the existing WebSocket infrastructure.

**Tech Stack:** Prisma 6 (schema + migration), Next.js 16 (server actions + API routes), Node.js `fs` APIs, existing WebSocket broadcast via web plugin routes.

**Spec:** `docs/superpowers/specs/file-upload-system-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `packages/database/prisma/schema.prisma` (modify) | Add `FileScope` enum, `File` model, `files File[]` relations on Project/Thread/Agent |
| `packages/plugin-contract/src/index.ts` (modify) | Add `uploadDir: string` to `OrchestratorConfig` |
| `apps/orchestrator/src/config.ts` (modify) | Read `UPLOAD_DIR` env var into config |
| `packages/plugins/web/src/_helpers/routes.ts` (modify) | Add `POST /api/broadcast` route |
| `apps/web/src/app/_helpers/notify-orchestrator.ts` | Shared helper for server actions to POST broadcast events to orchestrator |
| `apps/web/src/app/(chat)/chat/_actions/upload-file.ts` | Upload server action (validate → disk write → DB insert → broadcast) |
| `apps/web/src/app/(chat)/chat/_actions/delete-file.ts` | Delete server action (disk delete → DB delete → broadcast) |
| `apps/web/src/app/api/files/[id]/route.ts` | Next.js API route to serve files by ID |
| `packages/plugins/context/src/_helpers/load-file-references.ts` | DB query for scoped files → `FileReference[]` |
| `packages/plugins/context/src/_helpers/format-file-references.ts` | Format `FileReference[]` into markdown reference section |
| `packages/plugins/context/src/index.ts` (rewrite) | Replace filesystem discovery with DB-driven file references |
| `packages/plugins/context/src/_helpers/settings-schema.ts` (modify) | Remove `maxFileSizeKb` setting |

### Files to Delete

| File | Reason |
|------|--------|
| `packages/plugins/context/src/_helpers/file-cache.ts` | Filesystem caching no longer needed |
| `packages/plugins/context/src/_helpers/file-discovery.ts` | Filesystem discovery replaced by DB query |
| `packages/plugins/context/src/_helpers/file-reader.ts` | File content reading replaced by path references |
| `packages/plugins/context/src/_helpers/match-pattern.ts` | Glob matching no longer needed |
| `packages/plugins/context/src/_helpers/default-discovery-config.ts` | Discovery config no longer needed |
| `packages/plugins/context/src/_helpers/format-context-section.ts` | Replaced by `format-file-references.ts` |

### Test Files

| File | Tests for |
|------|-----------|
| `packages/plugins/context/src/_helpers/__tests__/load-file-references.test.ts` | DB query scoping, path resolution |
| `packages/plugins/context/src/_helpers/__tests__/format-file-references.test.ts` | Markdown formatting, grouping by scope, empty list |
| `apps/web/src/app/(chat)/chat/_actions/__tests__/upload-file.test.ts` | Validation, disk write, DB insert, error rollback |
| `apps/web/src/app/(chat)/chat/_actions/__tests__/delete-file.test.ts` | Disk delete, DB delete, missing file |
| `apps/web/src/app/api/files/[id]/__tests__/route.test.ts` | File serving, 404, content-type |
| `packages/plugins/context/src/__tests__/index.test.ts` (rewrite) | Reworked onBeforeInvoke with file references |

### Config/Environment Files

| File | Change |
|------|--------|
| `.env.example` | Add `UPLOAD_DIR=./uploads` |
| `packages/database/.env.example` | No change |
| `.gitignore` | Add `uploads/` |

---

## Chunk 1: Database Schema + Environment Setup

### Task 1: Add FileScope enum and File model to Prisma schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add FileScope enum after the existing MemoryScope enum (around line 169)**

```prisma
enum FileScope {
  PROJECT
  THREAD
  DECORATIVE
}
```

- [ ] **Step 2: Add File model after the enum**

```prisma
model File {
  id            String    @id @default(cuid())
  name          String
  path          String    @unique
  mimeType      String
  size          Int
  scope         FileScope
  extractedText String?   @db.Text

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

- [ ] **Step 3: Add `files File[]` relation to Project model (line ~54, after `cronJobs`)**

```prisma
  files        File[]
```

- [ ] **Step 4: Add `files File[]` relation to Thread model (line ~35, after `memories`)**

```prisma
  files        File[]
```

- [ ] **Step 5: Add `files File[]` relation to Agent model (line ~192, after `cronJobs`)**

```prisma
  files        File[]
```

- [ ] **Step 6: Generate Prisma client and push schema**

Run: `pnpm db:generate && pnpm db:push`
Expected: Prisma client regenerated, schema pushed to DB with new `File` table and `FileScope` enum.

- [ ] **Step 7: Verify the schema compiles**

Run: `pnpm --filter database build`
Expected: Clean build, new types exported from `database` package.

- [ ] **Step 8: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(database): add File model and FileScope enum for upload system"
```

---

### Task 2: Add uploadDir to OrchestratorConfig

**Files:**
- Modify: `packages/plugin-contract/src/index.ts:18-28`
- Modify: `apps/orchestrator/src/config.ts:30-44`

- [ ] **Step 1: Add `uploadDir` to `OrchestratorConfig` type**

In `packages/plugin-contract/src/index.ts`, add after line 27 (`logLevel: LogLevel;`):

```typescript
  uploadDir: string;
```

- [ ] **Step 2: Read `UPLOAD_DIR` env var in `loadConfig`**

In `apps/orchestrator/src/config.ts`, add after the `logLevel` line (line 40):

```typescript
    uploadDir: process.env.UPLOAD_DIR ?? './uploads',
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter plugin-contract build && pnpm --filter orchestrator build`
Expected: Clean build. Any plugin reading `ctx.config.uploadDir` now has the type.

- [ ] **Step 4: Commit**

```bash
git add packages/plugin-contract/src/index.ts apps/orchestrator/src/config.ts
git commit -m "feat(config): add uploadDir to OrchestratorConfig"
```

---

### Task 3: Environment and gitignore setup

**Files:**
- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Add `UPLOAD_DIR` to `.env.example`**

Add after the `LOG_LEVEL` line:

```bash
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10
```

- [ ] **Step 2: Add `uploads/` to `.gitignore`**

Add before the `# Prisma generated client` section:

```
# File uploads (local dev)
uploads/
```

- [ ] **Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add UPLOAD_DIR env var and gitignore uploads directory"
```

---

## Chunk 2: Broadcast Route + Notify Helper

### Task 4: Add generic broadcast route to web plugin

**Files:**
- Modify: `packages/plugins/web/src/_helpers/routes.ts`
- Test: `packages/plugins/web/src/_helpers/__tests__/routes.test.ts` (if exists, add tests; otherwise create)

The web plugin already has purpose-built endpoints that call `ctx.broadcast()` (e.g., `/api/audit-delete`). Adding a generic `/api/broadcast` route lets server actions emit any event without needing a new route each time.

- [ ] **Step 1: Write failing test for the broadcast endpoint**

Create or add to `packages/plugins/web/src/_helpers/__tests__/routes.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';

// Test that POST /api/broadcast calls ctx.broadcast with the provided event and data
describe('POST /api/broadcast', () => {
  it('broadcasts the event and data', async () => {
    // ... setup express app with mock ctx, POST to /api/broadcast
    // body: { event: 'file:uploaded', data: { fileId: '123' } }
    // assert ctx.broadcast was called with ('file:uploaded', { fileId: '123' })
    // assert response status 200
  });

  it('returns 400 when event is missing', async () => {
    // POST with body: { data: {} }
    // assert response status 400
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter plugin-web test`
Expected: FAIL — route does not exist yet.

- [ ] **Step 3: Add the broadcast route to routes.ts**

In `packages/plugins/web/src/_helpers/routes.ts`, add after the `/api/audit-delete` handler (around line 125):

```typescript
  // POST /api/broadcast — generic event broadcast to WebSocket clients
  app.post('/api/broadcast', async (req: Request, res: Response) => {
    const body = req.body as Partial<{ event: string; data: unknown }>;

    if (!body.event || typeof body.event !== 'string') {
      res.status(400).json({ error: 'Missing or invalid event' });
      return;
    }

    try {
      await ctx.broadcast(body.event, body.data ?? {});
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Broadcast endpoint error', { error: message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter plugin-web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/web/src/_helpers/routes.ts packages/plugins/web/src/_helpers/__tests__/routes.test.ts
git commit -m "feat(web): add generic POST /api/broadcast route"
```

---

### Task 5: Create notify-orchestrator helper for server actions

**Files:**
- Create: `apps/web/src/app/_helpers/notify-orchestrator.ts`
- Test: `apps/web/src/app/_helpers/__tests__/notify-orchestrator.test.ts`

Server actions need a shared way to fire broadcast events. This helper wraps the `POST /api/broadcast` call — fire-and-forget, swallows errors (same pattern as `request-audit-delete.ts`).

- [ ] **Step 1: Write failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { notifyOrchestrator } from '../notify-orchestrator';

// Mock fetch
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

// Mock getOrchestratorUrl
vi.mock('@/app/_helpers/get-orchestrator-url', () => ({
  getOrchestratorUrl: () => 'http://localhost:4001',
}));

describe('notifyOrchestrator', () => {
  it('posts event and data to /api/broadcast', async () => {
    await notifyOrchestrator('file:uploaded', { fileId: '123' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4001/api/broadcast',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ event: 'file:uploaded', data: { fileId: '123' } }),
      }),
    );
  });

  it('does not throw on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('unreachable'));
    await expect(notifyOrchestrator('file:uploaded', {})).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- notify-orchestrator`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement notify-orchestrator.ts**

```typescript
import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';

type NotifyOrchestrator = (event: string, data: unknown) => Promise<void>;

export const notifyOrchestrator: NotifyOrchestrator = async (event, data) => {
  fetch(`${getOrchestratorUrl()}/api/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, data }),
  }).catch(() => {
    // Fire-and-forget — orchestrator unavailability should not break uploads
  });
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- notify-orchestrator`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/_helpers/notify-orchestrator.ts apps/web/src/app/_helpers/__tests__/notify-orchestrator.test.ts
git commit -m "feat(web): add notify-orchestrator helper for broadcast events"
```

---

## Chunk 3: Upload and Delete Server Actions

### Task 6: Create upload-file server action

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_actions/upload-file.ts`
- Test: `apps/web/src/app/(chat)/chat/_actions/__tests__/upload-file.test.ts`

Reference pattern: `apps/web/src/app/(chat)/chat/_actions/send-message.ts` — same structure (validate → DB write → revalidatePath → return result).

**Important context for implementer:**
- The `FileScope` type is exported from `database` package (Prisma-generated enum).
- File path format: `{scopeFolder}/{parentId}/{fileId}-{sanitized-name}` where `scopeFolder` is `projects`, `threads`, or `agents`.
- Use `node:fs/promises` for `mkdir` and `writeFile`.
- Use `createId()` from `@paralleldrive/cuid2` for file ID generation (same library Prisma uses for `@default(cuid())`).
- After successful upload, call `notifyOrchestrator('file:uploaded', { ... })` fire-and-forget.
- On DB failure after disk write, clean up the disk file.

- [ ] **Step 1: Write failing tests**

Test cases:
1. Rejects file exceeding MAX_FILE_SIZE_MB (broadcasts `file:upload-failed`)
2. Rejects disallowed MIME type (broadcasts `file:upload-failed`)
3. Rejects PROJECT scope without projectId
4. Rejects THREAD scope without threadId
5. Rejects DECORATIVE scope without agentId
6. Successful upload: writes file to disk, creates DB record, returns File, broadcasts `file:uploaded`
7. DB failure after disk write: cleans up disk file

Mock `node:fs/promises` and `prisma` at module level. Do NOT mock the filesystem with real disk writes.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- upload-file`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement upload-file.ts**

```typescript
'use server';

import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { File as DbFile, FileScope } from '@harness/database';
import { prisma } from '@harness/database';
import { createId } from '@paralleldrive/cuid2';
import { revalidatePath } from 'next/cache';
import { notifyOrchestrator } from '@/app/_helpers/notify-orchestrator';

const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_MB ?? '10') * 1024 * 1024;
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

const ALLOWED_MIME_PREFIXES = ['text/'];
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/json',
  'application/xml',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const SCOPE_FOLDERS: Record<FileScope, string> = {
  PROJECT: 'projects',
  THREAD: 'threads',
  DECORATIVE: 'agents',
};

type SanitizeFilename = (name: string) => string;

const sanitizeFilename: SanitizeFilename = (name) => {
  return name
    .replace(/[^\w.\-]/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 200);
};

type IsAllowedMimeType = (mimeType: string) => boolean;

const isAllowedMimeType: IsAllowedMimeType = (mimeType) => {
  if (ALLOWED_MIME_TYPES.has(mimeType)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
};

type UploadFileInput = {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  scope: FileScope;
  projectId?: string;
  threadId?: string;
  agentId?: string;
};

type UploadFileResult = { file: DbFile } | { error: string };
type UploadFile = (input: UploadFileInput) => Promise<UploadFileResult>;

export const uploadFile: UploadFile = async (input) => {
  const { fileBuffer, fileName, mimeType, scope, projectId, threadId, agentId } = input;

  const broadcastFailure = (error: string) => {
    void notifyOrchestrator('file:upload-failed', { name: fileName, error, scope, projectId, threadId });
  };

  // Validate size
  if (fileBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    const error = `File exceeds maximum size of ${process.env.MAX_FILE_SIZE_MB ?? '10'}MB`;
    broadcastFailure(error);
    return { error };
  }

  // Validate MIME type
  if (!isAllowedMimeType(mimeType)) {
    const error = `File type '${mimeType}' is not allowed`;
    broadcastFailure(error);
    return { error };
  }

  // Validate scope/FK consistency
  if (scope === 'PROJECT' && !projectId) {
    return { error: 'projectId is required for PROJECT scope' };
  }
  if (scope === 'THREAD' && !threadId) {
    return { error: 'threadId is required for THREAD scope' };
  }
  if (scope === 'DECORATIVE' && !agentId) {
    return { error: 'agentId is required for DECORATIVE scope' };
  }

  const fileId = createId();
  const sanitized = sanitizeFilename(fileName);
  const parentId = scope === 'PROJECT' ? projectId! : scope === 'THREAD' ? threadId! : agentId!;
  const relativePath = join(SCOPE_FOLDERS[scope], parentId, `${fileId}-${sanitized}`);
  const fullPath = join(UPLOAD_DIR, relativePath);

  // Write to disk
  try {
    await mkdir(join(UPLOAD_DIR, SCOPE_FOLDERS[scope], parentId), { recursive: true });
    await writeFile(fullPath, fileBuffer);
  } catch (err) {
    return { error: `Disk write failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Insert DB record
  let file: DbFile;
  try {
    file = await prisma.file.create({
      data: {
        id: fileId,
        name: fileName,
        path: relativePath,
        mimeType,
        size: fileBuffer.byteLength,
        scope,
        projectId: scope === 'PROJECT' ? projectId : null,
        threadId: scope === 'THREAD' ? threadId : null,
        agentId: scope === 'DECORATIVE' ? agentId : null,
      },
    });
  } catch (err) {
    // Clean up disk file on DB failure
    try { await unlink(fullPath); } catch { /* best effort */ }
    return { error: `Database error: ${err instanceof Error ? err.message : String(err)}` };
  }

  revalidatePath('/');

  void notifyOrchestrator('file:uploaded', {
    fileId: file.id,
    name: file.name,
    scope: file.scope,
    projectId: file.projectId,
    threadId: file.threadId,
    agentId: file.agentId,
    mimeType: file.mimeType,
    size: file.size,
  });

  return { file };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- upload-file`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(chat)/chat/_actions/upload-file.ts apps/web/src/app/(chat)/chat/_actions/__tests__/upload-file.test.ts
git commit -m "feat(web): add upload-file server action"
```

---

### Task 7: Create delete-file server action

**Files:**
- Create: `apps/web/src/app/(chat)/chat/_actions/delete-file.ts`
- Test: `apps/web/src/app/(chat)/chat/_actions/__tests__/delete-file.test.ts`

**Key rule from spec:** Disk delete BEFORE DB delete. If disk delete fails, DB record persists and user can retry.

- [ ] **Step 1: Write failing tests**

Test cases:
1. Successful delete: removes disk file, deletes DB record, returns success
2. File record not found: returns error
3. Disk file already missing: logs warning, still deletes DB record (idempotent)
4. Broadcasts `file:deleted` event after success

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- delete-file`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement delete-file.ts**

```typescript
'use server';

import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { notifyOrchestrator } from '@/app/_helpers/notify-orchestrator';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

type DeleteFileResult = { ok: true } | { error: string };
type DeleteFile = (fileId: string) => Promise<DeleteFileResult>;

export const deleteFile: DeleteFile = async (fileId) => {
  const file = await prisma.file.findUnique({ where: { id: fileId } });

  if (!file) {
    return { error: 'File not found' };
  }

  // Disk delete FIRST — if this fails, DB record persists and user can retry
  const fullPath = join(UPLOAD_DIR, file.path);
  try {
    await unlink(fullPath);
  } catch (err) {
    // ENOENT is OK — file already gone (idempotent)
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      return { error: `Disk delete failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  await prisma.file.delete({ where: { id: fileId } });

  revalidatePath('/');

  void notifyOrchestrator('file:deleted', {
    fileId: file.id,
    name: file.name,
    scope: file.scope,
    projectId: file.projectId,
    threadId: file.threadId,
    agentId: file.agentId,
  });

  return { ok: true };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- delete-file`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(chat)/chat/_actions/delete-file.ts apps/web/src/app/(chat)/chat/_actions/__tests__/delete-file.test.ts
git commit -m "feat(web): add delete-file server action"
```

---

## Chunk 4: File Serving API Route

### Task 8: Create Next.js API route for serving files

**Files:**
- Create: `apps/web/src/app/api/files/[id]/route.ts`
- Test: `apps/web/src/app/api/files/[id]/__tests__/route.test.ts`

This is the first API route in the web app. Uses Next.js App Router route handler pattern (`export const GET`).

**Important context for implementer:**
- Next.js 16 route handlers export named functions (`GET`, `POST`, etc.)
- The `params` prop is a `Promise` in Next.js 16: `const { id } = await params`
- Return `new Response(...)` or `NextResponse` — not express-style `res.json()`
- Read file from disk using `node:fs/promises`, return as `Buffer` in Response body
- ETag/If-None-Match support is deferred — `Cache-Control` header is sufficient for now

- [ ] **Step 1: Write failing tests**

Test cases:
1. Returns file with correct Content-Type header
2. Returns 404 when file ID not found in DB
3. Returns 404 when file exists in DB but not on disk
4. Sets Content-Disposition header for download

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- route`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement route.ts**

```typescript
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@harness/database';
import { NextResponse } from 'next/server';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

type RouteParams = { params: Promise<{ id: string }> };

export const GET = async (_request: Request, { params }: RouteParams) => {
  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const fullPath = join(UPLOAD_DIR, file.path);

  try {
    await stat(fullPath);
  } catch {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }

  const buffer = await readFile(fullPath);

  return new Response(buffer, {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename="${file.name}"`,
      'Content-Length': String(file.size),
      'Cache-Control': 'private, max-age=3600',
    },
  });
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test -- route`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/files/\[id\]/route.ts apps/web/src/app/api/files/\[id\]/__tests__/route.test.ts
git commit -m "feat(web): add file serving API route at /api/files/[id]"
```

---

## Chunk 5: Context Plugin Rework

### Task 9: Create load-file-references helper

**Files:**
- Create: `packages/plugins/context/src/_helpers/load-file-references.ts`
- Test: `packages/plugins/context/src/_helpers/__tests__/load-file-references.test.ts`

This replaces the filesystem discovery code. Queries File records from DB, resolves full disk paths, returns `FileReference[]`.

- [ ] **Step 1: Write failing tests**

Test cases:
1. Returns THREAD-scoped files for the given threadId
2. Returns PROJECT-scoped files when projectId is provided
3. Returns both THREAD and PROJECT files together (correct scoping)
4. Does NOT return DECORATIVE files (even if agentId matches)
5. Returns empty array when no files exist
6. Resolves full disk paths using uploadDir
7. When projectId is null, only returns THREAD-scoped files

Mock `ctx.db.file.findMany` to return test data.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter plugin-context test -- load-file-references`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement load-file-references.ts**

```typescript
import { join } from 'node:path';
import type { FileScope, PrismaClient } from '@harness/database';

export type FileReference = {
  name: string;
  mimeType: string;
  size: number;
  fullPath: string;
  scope: FileScope;
};

type LoadFileReferences = (
  db: PrismaClient,
  uploadDir: string,
  threadId: string,
  projectId: string | null,
) => Promise<FileReference[]>;

export const loadFileReferences: LoadFileReferences = async (db, uploadDir, threadId, projectId) => {
  const conditions: Array<{ threadId?: string; projectId?: string; scope: FileScope }> = [
    { threadId, scope: 'THREAD' },
  ];

  if (projectId) {
    conditions.push({ projectId, scope: 'PROJECT' });
  }

  const files = await db.file.findMany({
    where: { OR: conditions },
    orderBy: { createdAt: 'asc' },
    select: { name: true, mimeType: true, size: true, path: true, scope: true },
  });

  return files.map((f) => ({
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    fullPath: join(uploadDir, f.path),
    scope: f.scope,
  }));
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter plugin-context test -- load-file-references`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/context/src/_helpers/load-file-references.ts packages/plugins/context/src/_helpers/__tests__/load-file-references.test.ts
git commit -m "feat(context): add load-file-references helper for DB-driven file discovery"
```

---

### Task 10: Create format-file-references helper

**Files:**
- Create: `packages/plugins/context/src/_helpers/format-file-references.ts`
- Test: `packages/plugins/context/src/_helpers/__tests__/format-file-references.test.ts`

Pure formatting function — no I/O. Takes `FileReference[]`, returns markdown string grouped by scope.

- [ ] **Step 1: Write failing tests**

Test cases:
1. Formats PROJECT files under `## Project Files` heading
2. Formats THREAD files under `## Thread Files` heading
3. Groups both scopes correctly with `# Available Files` heading
4. Returns empty string when files array is empty
5. Formats size in human-readable form (KB, MB)
6. Includes MIME type and full path in each line

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter plugin-context test -- format-file-references`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement format-file-references.ts**

```typescript
import type { FileReference } from './load-file-references';

type FormatSize = (bytes: number) => string;

const formatSize: FormatSize = (bytes) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)}KB`;
  }
  return `${bytes}B`;
};

type FormatFileReferences = (files: FileReference[]) => string;

export const formatFileReferences: FormatFileReferences = (files) => {
  if (files.length === 0) return '';

  const projectFiles = files.filter((f) => f.scope === 'PROJECT');
  const threadFiles = files.filter((f) => f.scope === 'THREAD');

  const sections: string[] = ['# Available Files'];

  if (projectFiles.length > 0) {
    sections.push('\n## Project Files');
    for (const f of projectFiles) {
      sections.push(`- ${f.name} (${f.mimeType}, ${formatSize(f.size)}) → ${f.fullPath}`);
    }
  }

  if (threadFiles.length > 0) {
    sections.push('\n## Thread Files');
    for (const f of threadFiles) {
      sections.push(`- ${f.name} (${f.mimeType}, ${formatSize(f.size)}) → ${f.fullPath}`);
    }
  }

  return sections.join('\n');
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter plugin-context test -- format-file-references`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/context/src/_helpers/format-file-references.ts packages/plugins/context/src/_helpers/__tests__/format-file-references.test.ts
git commit -m "feat(context): add format-file-references helper for markdown output"
```

---

### Task 11: Rewrite context plugin index.ts — remove filesystem, add DB-driven references

**Files:**
- Modify: `packages/plugins/context/src/index.ts` (rewrite)
- Modify: `packages/plugins/context/src/_helpers/settings-schema.ts` (remove `maxFileSizeKb`)
- Rewrite: `packages/plugins/context/src/__tests__/index.test.ts`

This is the biggest single task. The context plugin changes from filesystem-based file discovery to DB-driven file path references. The `createContextPlugin` factory and `ContextPluginOptions` type are deleted.

**Critical rules from spec and CLAUDE.md:**
- File reference injection runs UNCONDITIONALLY — not skipped when `thread.sessionId` exists (unlike history)
- The session short-circuit only applies to conversation history
- The thread query already loads `projectId` — pass it to `loadFileReferences`
- The `onSettingsChange` handler stays (for `historyLimit`, `summaryLookback` etc.)
- Prompt assembly order: projectInstructions → projectMemory → userProfile → **fileReferences** → summary → history → prompt

- [ ] **Step 1: Remove `maxFileSizeKb` from settings-schema.ts**

Read `packages/plugins/context/src/_helpers/settings-schema.ts` and remove the `maxFileSizeKb` entry. Keep `historyLimit`, `historyLimitWithSummary`, and `summaryLookback`.

- [ ] **Step 2: Rewrite index.ts**

The new `index.ts` should:
- Remove all imports of: `file-cache`, `file-discovery`, `file-reader`, `format-context-section`, `match-pattern`, `default-discovery-config`
- Remove `ContextPluginOptions` type and `createContextPlugin` factory
- Remove `createRegister` closure pattern — use a flat `register` function
- Add imports for `loadFileReferences` and `formatFileReferences`
- In `onBeforeInvoke`:
  - Keep the thread DB query (sessionId, project.instructions, project.memory) — add `projectId` to the select
  - Call `loadFileReferences(ctx.db, ctx.config.uploadDir, threadId, thread.projectId)` — ALWAYS, not gated by sessionId
  - Call `formatFileReferences(fileRefs)` — produces the reference section
  - Replace `contextSection` with `fileReferencesSection` in `buildPrompt` call
  - Keep all history/summary logic unchanged
  - Keep session short-circuit for history only

New index.ts content:

```typescript
// Context plugin — injects file references, conversation history,
// and project context into prompts via onBeforeInvoke hook

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { formatFileReferences } from './_helpers/format-file-references';
import { formatHistorySection } from './_helpers/format-history-section';
import { formatSummarySection } from './_helpers/format-summary-section';
import { formatUserProfileSection } from './_helpers/format-user-profile-section';
import { loadHistory } from './_helpers/history-loader';
import { loadFileReferences } from './_helpers/load-file-references';
import { settingsSchema } from './_helpers/settings-schema';

const DEFAULT_HISTORY_LIMIT_WITH_SUMMARY = 25;
const DEFAULT_HISTORY_LIMIT = 50;
const DEFAULT_SUMMARY_LOOKBACK = 2;

type BuildPrompt = (parts: string[]) => string;

const buildPrompt: BuildPrompt = (parts) => {
  const nonEmpty = parts.filter((p) => p.length > 0);
  return nonEmpty.join('\n\n---\n\n');
};

const register = async (ctx: PluginContext): Promise<PluginHooks> => {
  let settings = await ctx.getSettings(settingsSchema);

  ctx.logger.info('Context plugin registered');

  return {
    onSettingsChange: async (pluginName: string) => {
      if (pluginName !== 'context') return;
      settings = await ctx.getSettings(settingsSchema);
      ctx.logger.info('Context plugin: settings reloaded');
    },

    onBeforeInvoke: async (threadId, prompt) => {
      let userProfileSection = '';
      let thread: {
        sessionId: string | null;
        projectId: string | null;
        project: { instructions: string | null; memory: string | null } | null;
      } | null = null;
      let dbAvailable = true;

      try {
        thread = await ctx.db.thread.findUnique({
          where: { id: threadId },
          select: {
            sessionId: true,
            projectId: true,
            project: { select: { instructions: true, memory: true } },
          },
        });
        const profile = await ctx.db.userProfile.findUnique({ where: { id: 'singleton' } });
        userProfileSection = formatUserProfileSection(profile);
      } catch (err) {
        dbAvailable = false;
        ctx.logger.warn(
          `Context plugin: DB unavailable during onBeforeInvoke [thread=${threadId}], skipping history: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // File references — always injected, even when session exists
      let fileReferencesSection = '';
      if (dbAvailable && thread) {
        try {
          const fileRefs = await loadFileReferences(
            ctx.db,
            ctx.config.uploadDir,
            threadId,
            thread.projectId,
          );
          fileReferencesSection = formatFileReferences(fileRefs);
        } catch (err) {
          ctx.logger.warn(
            `Context plugin: failed to load file references [thread=${threadId}]: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // Project-level sections
      const projectInstructionsSection = thread?.project?.instructions
        ? `<project_instructions>\n${thread.project.instructions}\n</project_instructions>`
        : null;

      const projectMemorySection = thread?.project?.memory
        ? `<project_memory>\n${thread.project.memory}\n</project_memory>`
        : null;

      let summarySection = '';
      let historySection = '';

      const summaryLookback = settings.summaryLookback ?? DEFAULT_SUMMARY_LOOKBACK;
      const histLimitWithSummary = settings.historyLimitWithSummary ?? DEFAULT_HISTORY_LIMIT_WITH_SUMMARY;
      const histLimitDefault = settings.historyLimit ?? DEFAULT_HISTORY_LIMIT;

      if (thread?.sessionId) {
        ctx.logger.info(`Skipping history injection for resumed session [thread=${threadId}]`);
      } else if (dbAvailable) {
        const summaries = await ctx.db.message.findMany({
          where: { threadId, kind: 'summary' },
          orderBy: { createdAt: 'desc' },
          take: summaryLookback,
          select: { content: true, createdAt: true },
        });

        const hasSummaries = summaries.length > 0;
        const rawLimit = hasSummaries ? histLimitWithSummary : histLimitDefault;

        if (hasSummaries) {
          summarySection = formatSummarySection([...summaries].reverse());
        }

        const historyResult = await loadHistory(ctx.db, threadId, rawLimit);
        historySection = formatHistorySection(historyResult);
      }

      return buildPrompt([
        projectInstructionsSection ?? '',
        projectMemorySection ?? '',
        userProfileSection,
        fileReferencesSection,
        summarySection,
        historySection,
        prompt,
      ]);
    },
  };
};

export const plugin: PluginDefinition = {
  name: 'context',
  version: '1.0.0',
  settingsSchema,
  register,
};
```

- [ ] **Step 3: Delete old filesystem helpers**

Delete these files (and their tests if they exist):
- `packages/plugins/context/src/_helpers/file-cache.ts`
- `packages/plugins/context/src/_helpers/file-discovery.ts`
- `packages/plugins/context/src/_helpers/file-reader.ts`
- `packages/plugins/context/src/_helpers/match-pattern.ts`
- `packages/plugins/context/src/_helpers/default-discovery-config.ts`
- `packages/plugins/context/src/_helpers/format-context-section.ts`

Also delete their test files from `__tests__/`.

- [ ] **Step 4: Rewrite context plugin tests**

The existing `packages/plugins/context/src/__tests__/index.test.ts` uses `createContextPlugin({ contextDir: ... })`. Rewrite to:
- Import `plugin` directly (no factory)
- Mock `ctx.db.file.findMany` instead of filesystem
- Test file reference injection alongside history/instructions
- Test that file references are injected even when `sessionId` exists
- Test that DECORATIVE files are never included
- Test empty file list produces no section
- Keep all existing history/summary test scenarios (adjust for removed factory pattern)

- [ ] **Step 5: Run all context plugin tests**

Run: `pnpm --filter plugin-context test`
Expected: All tests PASS.

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter plugin-context build`
Expected: Clean build.

- [ ] **Step 7: Check that plugin-registry still imports correctly**

Read `apps/orchestrator/src/plugin-registry/index.ts` — it imports `{ plugin as contextPlugin } from '@harness/plugin-context'`. The new `plugin` export matches this import. No change needed.

- [ ] **Step 8: Commit**

```bash
git add -A packages/plugins/context/
git commit -m "refactor(context): replace filesystem discovery with DB-driven file references"
```

---

### Task 12: Update context plugin CLAUDE.md

**Files:**
- Modify: `packages/plugins/context/CLAUDE.md`

- [ ] **Step 1: Rewrite CLAUDE.md to reflect the new architecture**

Key changes:
- Remove all references to `contextDir`, filesystem discovery, file cache, mtime, truncation, priority ordering
- Document the new DB-driven file reference injection
- Document that file references are injected UNCONDITIONALLY (not skipped with sessionId)
- Keep the session resumption short-circuit section (for history only)
- Update the prompt assembly order to include file references section

- [ ] **Step 2: Commit**

```bash
git add packages/plugins/context/CLAUDE.md
git commit -m "docs(context): update CLAUDE.md for DB-driven file references"
```

---

## Chunk 6: Cascade Cleanup + Startup Check

### Task 13: Add disk cleanup to delete-project and delete-thread server actions

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/_actions/delete-project.ts`
- Modify: `apps/web/src/app/(chat)/chat/_actions/delete-thread.ts`
- Test: Update existing tests for both actions

The spec requires that disk files are deleted BEFORE the DB cascade fires. When a project or thread is deleted, its `File` records cascade-delete from the DB — but the disk files would be orphaned if not cleaned up first.

- [ ] **Step 1: Read the existing delete-project.ts and delete-thread.ts**

Understand the current flow. The change: BEFORE the `prisma.project.delete()` or `prisma.thread.delete()` call, query associated File records and delete their disk files.

- [ ] **Step 2: Add disk cleanup to delete-project.ts**

Before the `prisma.project.delete()` call, add:

```typescript
// Clean up disk files before cascade deletes DB records
const files = await prisma.file.findMany({
  where: { projectId },
  select: { path: true },
});
for (const file of files) {
  try {
    await unlink(join(UPLOAD_DIR, file.path));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`Failed to delete file ${file.path}: ${err}`);
    }
  }
}
```

- [ ] **Step 3: Add disk cleanup to delete-thread.ts**

Same pattern — query `prisma.file.findMany({ where: { threadId } })` and delete disk files before the thread cascade.

- [ ] **Step 4: Add test cases for disk cleanup**

For both actions, add a test that:
1. Creates File records associated with the project/thread
2. Calls the delete action
3. Asserts `unlink` was called for each file path

- [ ] **Step 5: Run tests**

Run: `pnpm --filter web test -- delete-project delete-thread`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(chat)/chat/_actions/delete-project.ts apps/web/src/app/(chat)/chat/_actions/delete-thread.ts apps/web/src/app/(chat)/chat/_actions/__tests__/
git commit -m "feat(web): add disk file cleanup before project/thread cascade delete"
```

---

### Task 14: Add UPLOAD_DIR startup health check

**Files:**
- Modify: `apps/orchestrator/src/config.ts`

- [ ] **Step 1: Add directory check in loadConfig or as a separate startup step**

After `loadConfig` resolves the `uploadDir`, verify the directory exists and is writable. Log a warning if not — don't crash the orchestrator.

```typescript
import { access, constants, mkdir } from 'node:fs/promises';

type CheckUploadDir = (dir: string) => Promise<void>;

const checkUploadDir: CheckUploadDir = async (dir) => {
  try {
    await mkdir(dir, { recursive: true });
    await access(dir, constants.W_OK);
  } catch (err) {
    console.warn(`UPLOAD_DIR '${dir}' is not writable: ${err}. File uploads will fail.`);
  }
};
```

Call this during orchestrator startup (after config is loaded, before plugins start).

- [ ] **Step 2: Commit**

```bash
git add apps/orchestrator/src/config.ts
git commit -m "feat(orchestrator): add UPLOAD_DIR startup health check"
```

---

## Chunk 7: Final Verification

### Task 15: Full build + typecheck + test

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: Clean (no new errors introduced).

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (context plugin tests rewritten, new tests for upload/delete/helpers).

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: Clean.

- [ ] **Step 4: Manual smoke test (optional)**

1. Start the dev server: `pnpm dev`
2. Verify the orchestrator starts without errors (check logs for `UPLOAD_DIR` config)
3. Verify sending a message still works (context plugin injects empty file references gracefully)

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
