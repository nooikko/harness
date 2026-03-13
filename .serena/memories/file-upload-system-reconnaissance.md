# File Upload System Reconnaissance Report

**Date:** 2026-03-12  
**Task:** Understanding how context files, project data, and reference materials are currently handled in the Harness orchestrator system, to inform building a file upload system.

---

## EXECUTIVE SUMMARY

**Current State:** Harness has a **sophisticated file reading system** (context plugin) that reads `.md` files from a disk-based `context/` directory. However, it is **fully read-only** — there is no file upload capability, no storage backend, no database models for file metadata, and no UI for file management.

**Key Gap:** Users cannot currently upload files through the UI. The system only reads pre-placed files from the filesystem.

---

## 1. CONTEXT FILE FLOW (END-TO-END)

### 1.1 — File Reading: `@harness/plugin-context`

**Location:** `packages/plugins/context/src/`

**Lifecycle:**
1. `onBeforeInvoke` hook fires before Claude is invoked
2. `readContextFiles(contextDir)` reads all `.md` files from disk
3. Files are formatted into a markdown section and prepended to the prompt
4. Files are retrieved with a 5-second TTL cache + mtime-based invalidation

**File Discovery & Priority:**

```typescript
// Priority order (files load in this order):
const DEFAULT_PRIORITY_FILES = [
  'memory.md',
  'world-state.md',
  'thread-summaries.md',
  'inbox.md',
];
// All other files load alphabetically after these four
```

**Constraints:**
- Default context directory: `process.cwd()/context` (can be overridden in options)
- Max file size: 50KB (files larger than this are truncated with marker `[... truncated at 50000 bytes]`)
- File type: Only `.md` (markdown) files discovered
- Empty files: Silently skipped
- DB failure: If conversation history DB fails, plugin continues with files only (no error propagation)

### 1.2 — File Caching

**File Cache Implementation** (`file-cache.ts`):
- **TTL:** 5 seconds (configurable)
- **Invalidation:** mtime-based + TTL check
- **Behavior:** Reads `statSync()` on cache hit to verify mtime hasn't changed
- **Module-level:** Cache persists across multiple `onBeforeInvoke` calls for the lifetime of the orchestrator process

```typescript
// Cache hit path:
cache.get(filePath)
  → if TTL < 5s && mtime unchanged → return cached content
  → else → re-read from disk + update cache
```

### 1.3 — Prompt Assembly Order

**Format:**
```
[Project Instructions XML]
[Project Memory XML]
---
[Context Files Section]
---
[Summaries Section]
---
[Conversation History Section]
---
[Original Base Prompt]
```

**Sections are separated by** `\n\n---\n\n`

**Empty sections omitted:** If no context files exist, that section is skipped entirely (not an empty heading).

**Session short-circuit:** If `thread.sessionId` is set (session already exists in Claude's subprocess), the plugin skips history injection entirely and only prepends context files + project data.

---

## 2. PROJECT DATA MODELS

### 2.1 — Project Model (Prisma)

```prisma
model Project {
  id           String    @id @default(cuid())
  name         String
  description  String?   @db.Text
  instructions String?   @db.Text    // ← Injected as <project_instructions>
  memory       String?   @db.Text    // ← Injected as <project_memory> + managed by agents
  model        String?                // Optional: override default model for project threads
  threads      Thread[]
  memories     AgentMemory[]
  cronJobs     CronJob[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

**Key Fields:**
- `instructions` — free-form text injected into every prompt for threads in this project (XML-tagged)
- `memory` — agent-managed project-level context (read-only in UI, written by agents via MCP tools)
- `model` — optional model override (inherits from config if null)

**UI for Project Data:** `apps/web/src/app/(chat)/chat/projects/[project-id]/_components/project-settings-form.tsx`
- Edit name, description, model, instructions
- View (read-only) memory field
- No file upload UI

### 2.2 — Agent Model (Prisma)

```prisma
model Agent {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  version     Int      @default(1)
  enabled     Boolean  @default(true)
  soul        String   @db.Text       // Agent personality/identity
  identity    String   @db.Text       // Agent description
  userContext String?  @db.Text       // Additional context
  role        String?                 // Optional: role description
  goal        String?                 // Optional: goal description
  backstory   String?  @db.Text       // Optional: detailed backstory
  threads     Thread[]
  memories    AgentMemory[]
  config      AgentConfig?
  cronJobs    CronJob[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**UI for Agent Data:** `apps/web/src/app/(chat)/agents/_components/edit-agent-form.tsx`
- Edit: name, soul, identity, role, goal, backstory, userContext, enabled flag
- Config toggles: memoryEnabled, reflectionEnabled
- No file upload UI
- No avatar/image upload

### 2.3 — Thread Model (Prisma)

```prisma
model Thread {
  id                  String             @id @default(cuid())
  source              String             // e.g., 'builtin', 'discord'
  sourceId            String             // unique ID within that source
  name                String?            // Display name for thread
  kind                String             @default("general")  // 'general', 'cron', etc.
  status              String             @default("active")   // 'active', etc.
  sessionId           String?            // Session ID for Claude subprocess
  model               String?            // Optional: override model for this thread
  customInstructions  String?            // ← Per-thread custom instructions (UI managed)
  projectId           String?            // Links to project for memory + instructions
  agentId             String?            // Links to agent for identity injection
  parentThreadId      String?            // For sub-threads (delegation)
  messages            Message[]
  agentRuns           AgentRun[]
  memories            AgentMemory[]
  lastActivity        DateTime
  createdAt           DateTime
  updatedAt           DateTime           @updatedAt
}
```

**File-related Fields:** None. No attachment field. No file references.

**UI for Thread Data:**
- Create thread (no file upload)
- View/edit customInstructions
- No file attachment UI in chat

### 2.4 — Message Model (Prisma)

```prisma
model Message {
  id        String   @id @default(cuid())
  threadId  String
  role      String              // 'user' or 'assistant'
  kind      String   @default("text")  // 'text', 'summary', 'status', 'thinking', 'tool_call', 'tool_result'
  source    String   @default("builtin")  // 'builtin', 'discord', etc.
  content   String   @db.Text
  metadata  Json?                // ← Extensible JSON field (could store attachment refs)
  createdAt DateTime  @default(now())
}
```

**File-related Fields:** `metadata` (JSON, optional) — could theoretically store file references but currently unused.

---

## 3. WEB APP UI — CURRENT FILE HANDLING

### 3.1 — Chat Input Component

**Location:** `apps/web/src/app/(chat)/chat/_components/chat-input.tsx`

**Current Features:**
- Lexical rich-text editor (with history plugin)
- Beautiful mentions plugin for `/` command completion
- Agent selector dropdown
- Model selector dropdown
- Send button

**Missing:** No file upload input, no attachment button, no file picker.

### 3.2 — Project Settings Form

**Location:** `apps/web/src/app/(chat)/chat/projects/[project-id]/_components/project-settings-form.tsx`

**Current Features:**
- Edit name, description
- Model selector dropdown
- Edit instructions (textarea)
- View memory (read-only)

**Missing:** No file upload for project documents, no attachment management.

### 3.3 — Agent Edit Form

**Location:** `apps/web/src/app/(chat)/agents/_components/edit-agent-form.tsx`

**Current Features:**
- Edit name, soul, identity, role, goal, backstory
- Enable/disable toggle
- Memory + reflection feature toggles

**Missing:** No file upload for agent avatar, no document attachment.

### 3.4 — Admin Pages

**Existing admin pages:** cron-jobs, plugins, threads, agent-runs, tasks, usage

**No file management UI anywhere.**

---

## 4. ORCHESTRATOR API ENDPOINTS

**Location:** `packages/plugins/web/src/_helpers/routes.ts`

**Current Endpoints:**
```
POST /api/chat             → Send message to thread (text only)
POST /api/prewarm          → Pre-warm Claude session
POST /api/plugins/:name/reload  → Reload plugin settings
POST /api/audit-delete     → Extract & delete thread
GET  /api/threads          → List all threads
GET  /api/tasks            → List all tasks
GET  /api/metrics          → List metrics
GET  /api/health           → Health check
```

**Missing:** No file upload endpoint, no file storage endpoint, no file retrieval endpoint.

---

## 5. PLUGIN CONTRACT & EXTENSIBILITY

**Location:** `packages/plugin-contract/src/index.ts`

**PluginContext API:**
```typescript
ctx.db                  // PrismaClient — can read/write anything
ctx.invoker             // Call Claude as sub-agent
ctx.config              // OrchestratorConfig
ctx.logger              // Structured logging
ctx.sendToThread        // Run full pipeline
ctx.broadcast           // WebSocket broadcast event
ctx.getSettings         // Read typed plugin settings
ctx.notifySettingsChange // Trigger settings reload
```

**Available Hooks:**
- `onBeforeInvoke` (chain) — can transform prompt (used by context plugin)
- `onAfterInvoke` — notification only
- `onPipelineStart` / `onPipelineComplete` — notification only
- `onMessage` — notification only
- `onBroadcast`, `onSettingsChange`, `onTask*` — all notification-only

**File-related Capabilities:**
- No specialized file API in PluginContext
- Plugins with `system: true` get unsandboxed `ctx.db` access
- Can read/write files directly via Node.js `fs` module
- Can broadcast events to browser via `ctx.broadcast()`

---

## 6. DATABASE-FILE RELATIONSHIPS

### 6.1 — No File Metadata Model

Currently **no `File`, `Asset`, `Attachment`, or `Upload` model** in Prisma schema.

**What exists for file references:**
- `Project.instructions` — Text field, not file path
- `Project.memory` — Text field, agent-managed
- `Thread.customInstructions` — Text field
- `Agent.soul`, `Agent.identity`, etc. — Text fields
- `Message.metadata` — JSON field (unused, could store file refs)

### 6.2 — Potential Storage Fields

If adding a file model, would likely need:
```prisma
model File {
  id           String    @id @default(cuid())
  name         String
  mimeType     String
  size         Int
  uploadedBy   String    // User ID or agent ID
  
  // Relationships — where can this file be attached?
  projectId    String?   // Attached to project?
  threadId     String?   // Attached to thread?
  agentId      String?   // Avatar for agent?
  
  // Storage
  storageKey   String    // Path in S3/GCS/local storage
  url          String?   // Public or signed URL
  
  createdAt    DateTime  @default(now())
  deletedAt    DateTime? // Soft delete for audit
}
```

---

## 7. STORAGE BACKENDS

**Current:** File system reading only (`context/` directory via `node:fs`)

**No cloud storage integration:**
- No S3 SDK
- No GCS client
- No Azure Blob Storage
- No local file upload directory

**No storage abstraction layer** — context plugin reads files directly with `readFileSync()`.

---

## 8. GAPS & MISSING PIECES

### 8.1 — Missing Database Models
- [ ] `File` model (metadata for uploaded files)
- [ ] File relationships on `Project`, `Thread`, `Agent`, `Message`
- [ ] File ownership/permissions

### 8.2 — Missing API Endpoints
- [ ] `POST /api/files/upload` — file upload handler
- [ ] `GET /api/files/:id` — file retrieval/download
- [ ] `DELETE /api/files/:id` — file deletion
- [ ] `GET /api/files?context=project_id` — list files for a context
- [ ] `POST /api/files/:id/attach` — attach file to thread/message

### 8.3 — Missing Storage Layer
- [ ] File storage abstraction (interface for S3/local/GCS)
- [ ] Stream-based upload handling (for large files)
- [ ] MIME type validation
- [ ] File size enforcement
- [ ] Virus scanning (optional)

### 8.4 — Missing Server Actions (Next.js)
- [ ] `upload-file.ts` — handle file upload from client
- [ ] `delete-file.ts` — delete uploaded file
- [ ] `attach-file-to-thread.ts` — link file to thread

### 8.5 — Missing UI Components
- [ ] File upload input (drag-drop + click)
- [ ] File attachment button in chat
- [ ] File list/browser for project
- [ ] File preview (for images, PDFs, etc.)
- [ ] Attachment display in chat messages

### 8.6 — Missing Context Plugin Enhancement
- [ ] Support for reading uploaded files instead of only filesystem files
- [ ] Integration with file model for dynamic file discovery
- [ ] File inclusion toggles in project/thread settings

### 8.7 — Missing Plugin Support
- [ ] MCP tool for agents to request file uploads
- [ ] File reference resolution in prompts
- [ ] File content injection into context (similar to disk-based files)

---

## 9. ARCHITECTURAL CONSTRAINTS & CONSIDERATIONS

### 9.1 — Plugin System Constraints
- **Innate vs. Extension:** File upload is **extension behavior** → belongs in a plugin, not orchestrator core
- **No file handling in `handleMessage`:** Upload logic should live in a dedicated plugin or in the web plugin
- **DB mutations via plugins:** File metadata writes should use `ctx.db` like all other plugins do

### 9.2 — Context Injection Constraints
- **Session short-circuit:** If thread has `sessionId`, history is skipped but files should still be injected (verify this still happens)
- **Project-level files:** Project files should be injected alongside thread files (need to distinguish)
- **Priority ordering:** File inclusion order matters (need to define how uploaded files rank vs. system files)

### 9.3 — Broadcast & Real-time Constraints
- **WebSocket delivery:** File upload progress should be broadcast to browser via `ctx.broadcast('file:uploaded', ...)`
- **No direct WebSocket:** Upload must go through HTTP API first, then broadcast to other clients

### 9.4 — Database Constraints
- **Prisma only:** All file metadata must be queryable via Prisma
- **Relationships:** Files attached to projects/threads/messages need proper FK indexes
- **Cascading deletes:** Deleting a project should cascade-delete attached files (or soft-delete)

---

## 10. REFERENCE IMPLEMENTATION POINTS

### 10.1 — Similar Systems Already Built

**Message persistence** (`apps/web/src/app/(chat)/chat/_actions/send-message.ts`):
- Pattern for server action → DB write → revalidatePath → fire-and-forget HTTP call

**Plugin hot-reload** (`packages/plugins/cron/src/index.ts`):
- Pattern for `onSettingsChange` → rebuild state from DB
- Could apply to file list: file upload → notify plugins → reload file cache

**Context file reading** (`packages/plugins/context/src/_helpers/file-reader.ts`):
- Pattern for discovering files, prioritizing, formatting, injecting into prompts
- Could extend to database-backed files

**Activity persistence** (`packages/plugins/activity/src/index.ts`):
- Pattern for `onPipelineStart` / `onPipelineComplete` writing rich metadata
- Could write file access logs or audit trails

### 10.2 — Plugin Pattern for File Handling

If implementing as a plugin:
```typescript
const filePlugin: PluginDefinition = {
  name: 'file',
  version: '1.0.0',
  
  register: async (ctx) => {
    // Expose file upload tools to Claude
    return {
      tools: [
        {
          name: 'request_file_upload',
          description: 'Ask user to upload a file (non-blocking)',
          handler: async (ctx, input, meta) => { ... }
        }
      ],
      onBeforeInvoke: async (threadId, prompt) => {
        // Inject uploaded files into prompt (like context plugin does)
        const files = await ctx.db.file.findMany({
          where: { threadId }
        });
        // Format and prepend files to prompt
        return buildPrompt([filesSection, prompt]);
      }
    };
  }
};
```

---

## 11. KEY FILES & LOCATIONS

| What | Where |
|------|-------|
| Context file reading | `packages/plugins/context/src/_helpers/file-reader.ts` |
| File cache | `packages/plugins/context/src/_helpers/file-cache.ts` |
| Prompt assembly order | `packages/plugins/context/src/index.ts` (lines 135-136) |
| Chat input UI | `apps/web/src/app/(chat)/chat/_components/chat-input.tsx` |
| Project settings UI | `apps/web/src/app/(chat)/chat/projects/[project-id]/_components/project-settings-form.tsx` |
| Agent edit UI | `apps/web/src/app/(chat)/agents/_components/edit-agent-form.tsx` |
| API routes | `packages/plugins/web/src/_helpers/routes.ts` |
| Message model | `packages/database/prisma/schema.prisma` (line 61-75) |
| Project model | `packages/database/prisma/schema.prisma` (line 45-59) |
| Agent model | `packages/database/prisma/schema.prisma` (line 171-196) |
| Thread model | `packages/database/prisma/schema.prisma` (line 15-43) |
| Plugin contract | `packages/plugin-contract/src/index.ts` |

---

## 12. RECOMMENDATIONS FOR NEXT STEPS

### Phase 1: Database & Core API
1. Add `File` model to Prisma schema with relationships
2. Create `POST /api/files/upload` endpoint in web plugin
3. Create server action `upload-file.ts` in Next.js
4. Implement basic file storage (local or S3)

### Phase 2: UI & Chat Integration
1. Add file upload button to chat input
2. Display file attachments in message history
3. Add file browser to project settings

### Phase 3: Context Integration
1. Enhance context plugin to read uploaded files
2. Add toggles for file inclusion
3. Implement file priority ordering

### Phase 4: Advanced Features
1. File preview components
2. Search across file content
3. Agent tools for file requests
4. Audit logging for file access

---

**End of Report**
