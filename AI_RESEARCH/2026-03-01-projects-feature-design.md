# Projects Feature Design — Harness

**Date:** 2026-03-01
**Status:** Research complete, ready for implementation planning
**Sources:** Codebase exploration + industry survey (Claude.ai, ChatGPT, Cursor, LangChain, Mem0, MemGPT, Anthropic docs)

---

## Executive Summary

This document synthesizes codebase state and industry research into a concrete design for adding Projects to Harness. The design requires:

1. A new `Project` Prisma model (3 fields beyond name/metadata)
2. A nullable `projectId` foreign key on `Thread`
3. An extension to the context plugin's `onBeforeInvoke` hook — no orchestrator changes

The entire feature fits within the existing plugin architecture. No new hooks, no orchestrator modifications.

---

## The Three-Field Core (User's Framing, Validated by Industry)

The user correctly identified the three substantive fields a project needs beyond name and metadata. Industry consensus from all surveyed platforms confirms this exactly:

| Field | What It Is | Written By | Injected? | Purpose |
|-------|-----------|-----------|-----------|---------|
| `description` | What this project is about | User | **No** | Display only — navigation, listing, human context |
| `instructions` | How the agent should behave | User | **Yes** — prepended, system-level | Tone, constraints, domain rules, persona |
| `memory` | What the agent has learned | Agent | **Yes** — after instructions | Accumulated facts, decisions, patterns |

**Critical distinction confirmed by Anthropic's own documentation:**
- `description` = hypothesis for humans
- `instructions` = static system rules
- `memory` = dynamic evidence from actual usage

The description field must be deliberately excluded from prompt injection. Every surveyed platform does this. The description is for the user navigating their projects, not for the agent.

---

## Industry Precedent

### Three-Tier Memory Model (Universal Consensus)

```
Tier 1: Global/Agent Memory  → user preferences, cross-project facts, communication style
Tier 2: Project Memory       → project instructions, domain knowledge, behavioral rules
Tier 3: Session Memory       → current thread context, in-progress work, ephemeral
```

This mirrors Mem0's production system (arXiv 2504.19413): `user_id` scope → `agent_id`/project scope → `run_id`/session scope. They report 26% accuracy improvement and 91% lower latency over baseline with this hierarchy.

### Platform Comparison

| Platform | Instructions | Memory | Files | Thread→Project |
|----------|-------------|--------|-------|----------------|
| Claude.ai | Yes (user-written) | Yes (agent-accumulated, markdown) | Yes (RAG) | projectId FK, immovable |
| ChatGPT | Yes (custom instructions) | Yes (auto memory logs) | Yes (40 files) | projectId FK, moveable |
| Cursor | Yes (.cursor/rules/) | Inferred from rules | N/A | Git repo = scope |
| Claude Code | Yes (CLAUDE.md hierarchy) | Yes (MEMORY.md, agent-written) | N/A | Git repo = scope |
| **Harness (current)** | Global only (context/ dir) | Global only (memory.md) | N/A | None |

### Prompt Injection Order (Anthropic Official)

From [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents):

```
1. Project Instructions     ← behavior established upfront
2. Project Memory           ← accumulated learnings
3. Global context files     ← system-wide (current context/ directory)
4. Conversation history     ← recent messages
5. Current user message     ← at end (highest attention weight)
```

This order has a measurable ~30% quality improvement when large documents are placed near the top (Anthropic's research). Instructions first ensures behavioral rules are processed before any content.

---

## Harness-Specific Design

### Database Schema

```prisma
model Project {
  id                       String    @id @default(cuid())
  name                     String
  description              String?   @db.Text    // Display only — NOT injected into prompts
  instructions             String?   @db.Text    // Behavioral rules, user-written
  memory                   String?   @db.Text    // Agent-accumulated learnings, full-replace CRUD
  model                    String?               // Override default model for all project threads
  settings                 Json?                 // Future: tool toggles, preferences
  threads                  Thread[]
  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt

  @@index([name])
}

// Thread model addition:
model Thread {
  // ... existing fields unchanged ...
  projectId    String?
  project      Project?  @relation(fields: [projectId], references: [id])
}
```

**Why `settings Json?`**: Defer specific toggles to later. Store as JSON blob now to avoid schema migrations for each future preference. Concrete candidates: default model, max history window, allowed tools.

### Context Plugin Extension

The context plugin (`packages/plugins/context/src/index.ts`) already owns prompt assembly. Extend its `onBeforeInvoke` to:

1. At the start of the hook, load the thread's project (if any) using `ctx.db`
2. Build project sections (instructions, memory)
3. Inject before existing global context sections

**New injection order in `buildPrompt`:**

```typescript
return buildPrompt([
  projectInstructionsSection,  // NEW: from project.instructions (if project exists)
  projectMemorySection,        // NEW: from project.memory (if project exists)
  contextSection,              // EXISTING: global context/ directory files
  summarySection,              // EXISTING: thread-summaries.md
  historySection,              // EXISTING: conversation history
  prompt                       // EXISTING: current user message
]);
```

**The context plugin already has `ctx.db` access** via `PluginContext`. The query is simple:

```typescript
const thread = await ctx.db.thread.findUnique({
  where: { id: threadId },
  select: {
    sessionId: true,
    model: true,
    kind: true,
    project: {
      select: { instructions: true, memory: true }
    }
  }
});
```

No new plugins, no orchestrator changes, no new hooks needed.

### Memory Separation

The key requirement: agent memory and project memory must be distinct scopes, each fully manageable.

| Scope | Location | Readable By Agent | Writable By Agent | Updated Via |
|-------|----------|------------------|------------------|-------------|
| **Agent/Global** | `context/memory.md` (filesystem) | Yes (via context/ dir) | Yes (file writes) | Current mechanism |
| **Project** | `Project.memory` (database) | Yes (via context plugin) | Yes (project plugin tools) | New tool suite |

**Global memory** stays as-is — the agent writes to `context/memory.md` via file system tools. Cross-project, cross-session, persists forever.

**Project memory** lives in `Project.memory` (database field). Agents get full CRUD — not just append. Sometimes facts need to be ablated (removed or corrected). The memory field is a structured markdown document the agent manages as a whole, replacing it entirely on each write. The agent is responsible for preserving what's still relevant, removing what's stale, and adding new observations.

**Project memory tools (new project plugin):**

```typescript
// Tool 1: Read current project memory (for inspection before editing)
{
  name: 'get_project_memory',
  description: 'Read the current project memory',
  handler: async (ctx, {}, { threadId }) => {
    const thread = await ctx.db.thread.findUnique({
      where: { id: threadId },
      select: { project: { select: { memory: true } } }
    });
    return thread?.project?.memory ?? '(no project memory yet)';
  }
}

// Tool 2: Write/replace project memory (full document, agent manages structure)
{
  name: 'set_project_memory',
  description: 'Write the complete project memory document. You are responsible for preserving existing facts that are still relevant, removing stale ones, and adding new observations.',
  handler: async (ctx, { memory }, { threadId }) => {
    const thread = await ctx.db.thread.findUnique({
      where: { id: threadId },
      select: { projectId: true }
    });
    if (!thread?.projectId) return 'No project associated with this thread';
    await ctx.db.project.update({
      where: { id: thread.projectId },
      data: { memory, updatedAt: new Date() }
    });
    return 'Project memory updated';
  }
}
```

**Why replace-not-append**: Giving the agent the full document and asking it to return a revised version is cleaner than a pure append log. The agent can reorganize, consolidate, and remove contradictions. This matches how Claude Code's MEMORY.md works — the agent edits the whole file.

### Instructions: User-Only via UI

Instructions are user-managed only. The agent has no tool to write them. If an agent wants to suggest an instruction change, it says so in the conversation — the user copies it into the project settings manually.

This keeps the boundary sharp without any gate mechanism. Future versions may revisit this.

### Thread-to-Project Association UI Flows

**Creating a thread in a project:**
- Project page has a "New Chat" button → creates Thread with `projectId` set
- Sidebar shows threads grouped under their project

**Standalone threads:**
- Threads with `projectId = null` appear in a "Direct Chats" section (current behavior)

**Moving threads:** Allowed. `Thread.projectId` is a nullable FK — moving is a single server action update. Threads can also be un-projected (moved to standalone) by setting `projectId = null`.

**Project sidebar navigation:**

Projects appear at the top of the sidebar, sorted by most recently active project first (based on max `lastActivity` across threads in the project, or the project's own `updatedAt`). Standalone/direct chats appear below in a separate section.

```
─── Projects ────────────────
📁 Active Project            ← most recently active project first
  💬 Thread A (2h ago)
  💬 Thread B (1d ago)
📁 Older Project
  💬 Thread C (3d ago)
─── Direct Chats ────────────
💬 Standalone Chat 1
💬 Standalone Chat 2
```

The projects section is collapsible per-project. A project with no threads is still visible (so users can start a new thread within it). "Primary" thread (kind: primary) remains pinned to the very top of Direct Chats if it has no project.

---

## What We Are NOT Building Yet

The user explicitly noted these are future concerns. Documented here to avoid scope creep:

- **File storage** — projects don't have files yet, only the 3 core fields + name
- **RAG/semantic search** — project memory is a plain text field for now; pgvector/vector search is future
- **Project templates** — future
- **Project sharing/permissions** — future
- **Agent-initiated project creation** — future (agent can update memory within a project, not create projects)

---

## Implementation Sequence (When Ready to Build)

1. **Schema migration** — Add `Project` model and `Thread.projectId` FK
2. **Database package** — Export `Project` type from `packages/database/src/index.ts`
3. **Context plugin** — Extend `onBeforeInvoke` to load and inject project context
4. **Project plugin (new)** — Register 2 tools: `get_project_memory`, `set_project_memory` (full replace, ablation-safe). Instructions are user-only.
5. **Web UI** — Project CRUD pages, sidebar grouping, thread creation within projects
6. **Server actions** — Create/update/delete project, associate thread

The context plugin extension (step 3) is the highest-leverage change — it makes project context work for all threads immediately once a project has an `instructions` or `memory` value.

---

## Resolved Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Memory append vs replace | **Full replace** — agent gets current doc via `get_project_memory`, returns revised doc via `set_project_memory` | Allows ablation/correction; matches MEMORY.md pattern in Claude Code |
| Can agent update instructions? | **No — user-only via UI** | No gate mechanism needed; agent suggests in conversation, user applies manually |
| Thread moving between projects | **Yes** — nullable FK update; also supports removing from project entirely | More flexible than Claude.ai; matches ChatGPT |
| Sidebar structure | **Projects section at top (sorted by recency), standalone chats below** | Projects are prominent; most recently active surfaces first |
| Promote existing thread to project | **Yes** — move works both directions | Simple FK update, no data migration |

---

## References

- [Claude Help Center - What are projects](https://support.claude.com/en/articles/9517075-what-are-projects)
- [Anthropic Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Claude Code Memory Documentation](https://code.claude.com/docs/en/memory)
- [Mem0 Research Paper (arXiv 2504.19413)](https://arxiv.org/abs/2504.19413)
- [MemGPT Paper (arXiv 2310.08560)](https://arxiv.org/abs/2310.08560)
- [LangMem Conceptual Guide](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/)
- [CrewAI Memory Docs](https://docs.crewai.com/en/concepts/memory)
- Harness codebase: `packages/plugins/context/src/index.ts`, `packages/database/prisma/schema.prisma`
