# Research: AI Projects — Memory Hierarchy and Context Management Industry Standards

Date: 2026-03-01

## Summary

This document synthesizes industry patterns for implementing "Projects" in AI assistant systems, covering how leading platforms structure project data, separate memory tiers, inject context into prompts, and handle the thread-to-project association. It concludes with specific schema and architectural recommendations for the Harness system.

## Prior Research

- `2026-03-01-agent-personality-memory-standards.md` — agent behavioral context patterns
- `2026-02-26-claude-code-context-files-reference.md` — Claude Code CLAUDE.md hierarchy
- `2026-02-26-self-updating-architectural-context-ai-assistants.md` — self-updating context patterns

---

## Current Findings

### 1. How Leading Platforms Implement "Projects"

#### Claude.ai Projects (Anthropic)

Launched June 2024. A Project is a self-contained workspace with:
- **Name** — user-visible identifier
- **Project Instructions** — instructions the user writes that tailor Claude's behavior for all chats in the project. Applied to every conversation in the project. Override global custom instructions.
- **Knowledge Base** — uploaded documents, PDFs, text files that Claude references. Capacity is 200K tokens per project. RAG (retrieval-augmented generation) used on Pro tier to extend capacity 10x.
- **Chat histories** — conversations scoped to the project, stored separately from non-project chats.
- **Memory** (new 2025 feature) — Claude synthesizes a "Memory summary" from past interactions, organized into categories like "Role & Work," "Current Projects," and "Personal Content." Stored as markdown files (CLAUDE.md pattern). Users can view and edit. Project memory is separate from user-level memory.

The architecture explicitly keeps each project's memory isolated: "product launch planning stays separate from client work."

**Context injection order** (inferred from behavior): project instructions → knowledge base content (via RAG retrieval) → conversation history → current message.

Sources: [Claude Help Center - What are projects](https://support.claude.com/en/articles/9517075-what-are-projects), [Anthropic Memory announcement](https://www.anthropic.com/news/memory), [Claude Projects Guide](https://www.instituteofaistudies.com/insights/how-to-use-claudes-projects)

#### ChatGPT Projects (OpenAI)

Launched late 2024, project-only memory added August 22, 2025. A Project stores:
- **Name** — with customizable icon and color
- **Custom Instructions** — project-level behavioral guidelines. Override global custom instructions for all chats in the project.
- **Knowledge Files** — up to 20 files (Plus) or 40 files (Pro) per project. Documents, PDFs, images, chat transcripts.
- **Tools configuration** — Canvas, Deep Research, Image Generation, Web Search toggleable per project.
- **Memory Logs** — automatic memory snippets the AI curates from conversations. Selective, not complete history.

Memory hierarchy: global memory → workspace memory → project-only memory. When "project-only memory" is enabled, the project only references memories from conversations in that project. This prevents cross-project contamination.

**UX for moving chats**: Conversations can be moved into existing projects via a three-dot menu. Treating projects as "living workspaces that accumulate relevant discussions."

Sources: [OpenAI Help Center - Projects in ChatGPT](https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt), [Unite.AI - ChatGPT Project Memory](https://www.unite.ai/how-to-use-chatgpts-project-memory/), [AI Fire - ChatGPT Projects feature](https://www.aifire.co/p/give-chatgpt-a-better-memory-a-look-at-the-projects-feature)

#### Cursor AI (Project Rules)

Rules are the Cursor equivalent of project instructions. Architecture:
- **User Rules** (`~/.cursor/rules/`) — apply to all projects on the machine
- **Project Rules** (`.cursor/rules/`) — scoped to the current project directory
- **Rules are injected at the start of model context** — before the user prompt
- **Path-scoped rules** — rules can specify `paths: ["src/api/**/*.ts"]` YAML frontmatter to only activate when matching files are in context
- Rule files are small, focused markdown files (not one big config)

Key insight from Cursor: "Rules without a paths field are loaded unconditionally and apply to all files. Path-scoped rules trigger when Claude reads files matching the pattern."

Sources: [Cursor Rules Docs](https://cursor.com/docs/context/rules)

#### Claude Code Memory Hierarchy (Most Detailed Technical Reference)

The most fully documented hierarchical memory system with 4 explicit levels:

| Level | Location | Scope | Who Writes |
|-------|----------|-------|-----------|
| Managed Policy | `/etc/claude-code/CLAUDE.md` | All users, org-wide | IT/DevOps |
| User Instructions | `~/.claude/CLAUDE.md` | This user, all projects | User |
| Project Instructions | `./CLAUDE.md` or `./.claude/CLAUDE.md` | This project, all team members | Team (checked in) |
| Local Instructions | `./CLAUDE.local.md` | This project, this user only | User (gitignored) |

Auto Memory (agent-written) stored at `~/.claude/projects/<project>/memory/MEMORY.md` — first 200 lines loaded every session. Topic files loaded on demand.

**Key distinction**: CLAUDE.md files = instructions you write. Auto memory = notes the agent writes from observations.

Sources: [Claude Code Memory Docs](https://code.claude.com/docs/en/memory)

---

### 2. Memory Hierarchy Patterns — Industry Standards

#### The Three-Tier Model (Industry Consensus)

Across all surveyed platforms, a three-tier model emerges:

```
Tier 1: Global/User Memory
  - Persists across all projects and sessions
  - User preferences, communication style, background
  - Rarely changes

Tier 2: Project Memory
  - Scoped to a specific project/workspace
  - Project instructions, behavioral rules, domain knowledge
  - Changes as project evolves
  - Isolated from other projects

Tier 3: Session/Thread Memory
  - Scoped to a single conversation thread
  - Current task context, in-progress work
  - Ephemeral (rebuilt per session or explicitly persisted)
```

Mem0's implementation explicitly models: `user_id` (global), `agent_id` (project-level), `run_id` (session). Their research shows 26% accuracy improvement and 91% lower p95 latency vs baseline approaches.

Sources: [Mem0 GitHub](https://github.com/mem0ai/mem0), [Mem0 Research](https://mem0.ai/research)

#### MemGPT / Letta — OS-Inspired Memory Architecture

The academic foundation (arXiv 2310.08560 "MemGPT: Towards LLMs as Operating Systems") defines:

- **Core Memory** (in-context) — always-accessible compressed essential facts. Analogous to RAM.
- **Recall Memory** (out-of-context) — searchable database of past interactions. Semantic search.
- **Archival Memory** (out-of-context) — long-term storage, moved back into core as needed.

The agent can autonomously manage its own memory via function calls, moving data between tiers.

Sources: [MemGPT arXiv](https://arxiv.org/abs/2310.08560), [Letta Agent Memory](https://www.letta.com/blog/agent-memory)

#### LangMem Memory Scopes (Hierarchical Namespaces)

LangMem uses namespaced hierarchical storage:
```
("acme_corp", "{user_id}", "code_assistant")
```
Three memory types:
- **Semantic Memory** — facts and knowledge (collections or profiles)
- **Episodic Memory** — past experiences and successful interactions
- **Procedural Memory** — behavioral rules via system prompts that evolve

Memory update patterns:
- **Active/Conscious**: Updates during conversations (immediate, adds latency)
- **Background/Subconscious**: Processing between interactions (batch, no latency impact)

Sources: [LangMem Conceptual Guide](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/)

#### LangGraph Store System (Most Production-Ready Pattern)

LangGraph implements a key-value store with hierarchical namespaces as tuples:
- `("users", user_id)` — user-scoped
- `("projects", project_id)` — project-scoped
- `("users", user_id, "projects", project_id)` — user+project scoped

Item schema:
```typescript
{
  namespace: string[],   // hierarchical path
  key: string,           // unique within namespace
  value: Record<string, unknown>,
  created_at: DateTime,
  updated_at: DateTime,
  ttl?: number           // minutes until expiry
}
```

Vector search support via `IndexConfig` for semantic retrieval from PostgreSQL/pgvector.

Sources: [LangGraph Store System DeepWiki](https://deepwiki.com/langchain-ai/langgraph/4.3-store-system), [LangGraph Long-Term Memory Docs](https://docs.langchain.com/oss/python/deepagents/long-term-memory)

#### CrewAI Memory System

The most comprehensive built-in memory system:
```
Memory record fields:
- content: string
- scope: string (hierarchical path, e.g., "/project/alpha")
- categories: string[] (inferred by LLM)
- importance: float (0-1)
- source: string ("agent:researcher")
- private: boolean
- timestamp: DateTime
- vector_embedding: float[] (for semantic search)
```

LLM-inferred scope assignment: "When you save without specifying scope, the LLM analyzes content and suggests placement automatically."

Before each task, relevant context is retrieved and injected. After each task, discrete facts are extracted and stored.

Sources: [CrewAI Memory Docs](https://docs.crewai.com/en/concepts/memory), [Sparkco Deep Dive](https://sparkco.ai/blog/deep-dive-into-crewai-memory-systems)

---

### 3. The Description vs. Instructions vs. Memory Distinction

This is one of the most important conceptual distinctions, confirmed across multiple platforms:

| Field | What It Is | Who Writes It | When It Changes | Injected As |
|-------|-----------|--------------|----------------|-------------|
| **Description** | What this project is about. Human-readable summary. Used for display/navigation. | User | Rarely | Not injected into prompts (or very briefly) |
| **Instructions** | How the agent should behave within this project. Rules, tone, constraints. | User | Occasionally, as project evolves | Prepended to every prompt as system-level context |
| **Memory** | What the agent has learned from past conversations within this project. | Agent (auto) or User (explicit) | After each conversation (background) or mid-conversation | Injected after instructions, before history |

From the research:
- "The system prompt is static hypothesis; memory is dynamic evidence from actual usage." (aimaker.substack.com)
- "Memory entries should be concise pointers: 'Do X, reference Y framework, avoid Z pattern.' Meanwhile, comprehensive documentation goes into knowledge base files." (aimaker.substack.com)
- "Instructions tell the LLM how to operate within a specific workspace and override global custom instructions but only within the project. In contrast, project memory consists of automatic memory logs." (Unite.AI)

From Claude Code docs: "CLAUDE.md files: instructions you write to give Claude persistent context. Auto memory: notes Claude writes itself based on your corrections and preferences."

---

### 4. Prompt Injection Patterns — Where Context Goes in the Context Window

From Anthropic's context engineering documentation:

**Recommended ordering** (from [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)):
1. CLAUDE.md / project instructions (upfront, establishes behavior)
2. System prompts (constraints and expected behaviors)
3. Long documents / knowledge base content (near top when large)
4. Recent conversation history (active context)
5. Current user message (at end)

Anthropic testing showed placing queries *after* context improves response quality by up to 30%. Claude's attention mechanisms weight content toward the end of prompts.

**XML tag structure** is recommended for separating context types:
```xml
<background_information>...</background_information>
<project_instructions>...</project_instructions>
<conversation_history>...</conversation_history>
<current_message>...</current_message>
```

**Security note**: The architectural literature consistently warns that mixing instructions and data in the same context window creates prompt injection vectors. Structural separation via XML tags is the primary mitigation.

From Anthropic docs (context windows): "As token count grows, accuracy and recall degrade — a phenomenon known as context rot. This makes curating what's in context just as important as how much space is available."

"Just-in-time retrieval" for knowledge base files is strongly preferred over pre-loading everything. Load lightweight identifiers; retrieve data dynamically via tools.

Sources: [Anthropic Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [Anthropic Context Windows](https://platform.claude.com/docs/en/build-with-claude/context-windows), [Anthropic Long Context Tips](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips)

---

### 5. Memory Update Flow — When and How Agents Update Memory

**Two dominant patterns** from the research:

**Pattern A: Background Consolidation (Preferred)**
- During conversation: store raw events in session scratch
- After conversation ends: background job extracts durable facts
- LLM-based extraction identifies what is worth keeping
- Prevents latency impact on user-facing responses
- Used by: LangMem, MemGPT, Claude.ai (nightly consolidation)

**Pattern B: In-Context Active Update (For Critical Context)**
- Mid-conversation: agent explicitly writes to memory storage
- Used when information absolutely must persist immediately
- Higher latency, used sparingly
- Used by: Claude Code auto memory (agent writes when it deems necessary)

**Memory consolidation pipeline** (from Mem0 and TeleMem research):
1. **Extraction** — identify candidate memories from conversation
2. **Deduplication/Conflict detection** — compare against existing memories
3. **Merge/Update** — integrate new facts, resolve conflicts
4. **Pruning** — remove outdated entries, maintain size limits

Key rule: "Only enhance when new information genuinely adds value without contradiction. Preserve timestamps and specific details from the original memory."

**The Harness CLAUDE.md already documents this pattern** explicitly in the Memory Consolidation section: nightly cron at 1:00 AM MST consolidates `inbox.md` into `memory.md`, with explicit rules for what to consolidate and what to skip.

---

### 6. Thread-to-Project Association Patterns

From surveyed platforms:

**Claude.ai**: Each chat in a Project is a new Thread linked to the Project. Chats cannot be moved between projects after creation.

**ChatGPT**: Chats can be moved into projects post-creation via a three-dot menu. Each chat (thread) has a `project_id` foreign key. Project-only memory toggle only available at project creation time.

**Claude Code**: Project scope is determined by the git repository root. All sessions/worktrees within the same git repo share one memory directory.

**Common data model pattern**:
```
Project
  id
  name
  description
  instructions (text, the system-level behavioral prompt)
  createdAt

Thread
  id
  projectId (nullable FK → Project)
  ...existing fields...
```

The `projectId` being nullable allows threads to exist outside of projects (current behavior) while also allowing threads to be scoped to a project.

---

### 7. Open Source Reference Implementations

**Microsoft Azure AI Foundry** uses `ProjectConversation` objects with:
- `CreateProjectConversationAsync()`
- `GetProjectConversationItemsAsync(conversationId)`
- `DeleteConversationAsync(conversationId)`

Each conversation (thread) is linked to a project. Project-level agents maintain their own persistent state separate from conversation history.

**LangGraph's namespace pattern** for Harness's PostgreSQL context:
```sql
-- Conceptual schema
CREATE TABLE memory_store (
  namespace TEXT[],     -- e.g., ARRAY['project', 'proj_123']
  key       TEXT,
  value     JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  ttl_minutes INT
);
CREATE INDEX ON memory_store (namespace);
-- Optional: pgvector for semantic search
-- CREATE INDEX ON memory_store USING hnsw (embedding vector_cosine_ops);
```

---

## Key Takeaways

### What Industry Consensus Says a "Project" Contains

1. **id** — unique identifier
2. **name** — display name
3. **description** — human-readable summary (what it's about, not behavioral)
4. **instructions** — behavioral system prompt (how the agent should act)
5. **memory** — agent-accumulated learnings (separate from instructions)
6. **files/knowledge** — reference documents (accessed via RAG, not pre-loaded)
7. **settings** — tool toggles, model preferences, scoped configuration

### The Three-Part Context Injection Stack

Every invocation for a thread in a project should build the prompt as:
```
[Project Instructions]
--- (separator)
[Project Memory — consolidated learnings]
--- (separator)
[Global Context Files — system-wide context/]
--- (separator)
[Thread Summary (if available)]
--- (separator)
[Conversation History — last N messages]
--- (separator)
[Current Message]
```

### Memory Update Timing

- **Inline writes** (current Harness behavior via context files): acceptable for the existing single-user system
- **Background consolidation** (nightly cron already in CLAUDE.md): the right pattern for accumulated memory
- **Per-project isolation**: memory updates should be scoped to the project, not written to global context files

---

## Schema Recommendations for Harness (Prisma/PostgreSQL)

### New `Project` Model

```prisma
model Project {
  id           String    @id @default(cuid())
  name         String
  description  String?   @db.Text
  instructions String?   @db.Text    // Behavioral system prompt for all threads in this project
  memory       String?   @db.Text    // Agent-accumulated learnings (updated by background consolidation)
  model        String?               // Override default model for this project
  settings     Json?                 // Tool toggles, custom config
  threads      Thread[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([name])
}
```

### Thread Model Additions

```prisma
model Thread {
  // ... existing fields ...
  projectId    String?
  project      Project?  @relation(fields: [projectId], references: [id])
  // ... rest of fields ...
}
```

### Optional: `ProjectMemoryEntry` for Structured Memory

For systems that want queryable/versioned project memory instead of a single text blob:

```prisma
model ProjectMemoryEntry {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  content   String   @db.Text
  category  String?  // "architecture", "preferences", "decisions"
  source    String?  // "agent:consolidation", "user:explicit"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, category])
}
```

### Context Plugin Extension

The context plugin's `onBeforeInvoke` would need to accept project context. The recommended prompt assembly order becomes:

```typescript
return buildPrompt([
  projectInstructionsSection,  // NEW: project behavioral instructions
  projectMemorySection,        // NEW: project-scoped accumulated memory
  contextSection,              // EXISTING: global context/ files
  summarySection,              // EXISTING: thread summaries
  historySection,              // EXISTING: conversation history
  prompt                       // EXISTING: current message
]);
```

---

## Gaps Identified

- **Confidence LOW**: ChatGPT's exact database schema for projects is not publicly documented. The fields described are inferred from UI behavior and help documentation.
- **Confidence LOW**: Exact prompt injection order for Claude.ai Projects is not documented in official Anthropic docs. The ordering described is inferred from community analysis and general Anthropic prompting guidance.
- **UNKNOWN**: Whether Claude.ai Projects use RAG retrieval at invocation time or full inclusion for knowledge files below the context limit. Help docs mention RAG for exceeding the 200K limit, implying full inclusion below it.
- **Not researched**: Specific PostgreSQL pgvector schema for semantic memory retrieval. This would be needed if Harness wanted to support retrieval-augmented project memory rather than full-text injection.

---

## Recommendations for Next Steps

1. **Add `Project` model to Prisma schema** with `name`, `description`, `instructions`, `memory`, optional `model` override, and `settings` JSON.
2. **Add nullable `projectId` to `Thread` model** to associate threads with projects.
3. **Extend the context plugin** to accept an optional `project` parameter in `onBeforeInvoke`, injecting project instructions and memory before global context files.
4. **Create a project memory consolidation cron** that extracts durable facts from project thread history and updates `project.memory`.
5. **The description field** should intentionally NOT be injected into prompts — it is for human navigation only. Only `instructions` and `memory` go into the prompt.
6. **Project instructions should be concise** (target under 100 lines, similar to CLAUDE.md guidance). Large reference material belongs in knowledge files accessed via tools.
7. **The `kind: "summary"` message pattern** already in the Harness message model could be extended with `kind: "project_memory_update"` to track when project memory was last updated and by what.

---

## Sources

- [Claude Help Center - What are projects](https://support.claude.com/en/articles/9517075-what-are-projects)
- [Anthropic Memory Announcement](https://www.anthropic.com/news/memory)
- [OpenAI Help Center - Projects in ChatGPT](https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt)
- [Unite.AI - ChatGPT Project Memory Guide](https://www.unite.ai/how-to-use-chatgpts-project-memory/)
- [Cursor Rules Documentation](https://cursor.com/docs/context/rules)
- [Claude Code Memory Documentation](https://code.claude.com/docs/en/memory)
- [Anthropic Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic Context Windows API Docs](https://platform.claude.com/docs/en/build-with-claude/context-windows)
- [MemGPT arXiv Paper 2310.08560](https://arxiv.org/abs/2310.08560)
- [Letta Agent Memory Blog](https://www.letta.com/blog/agent-memory)
- [LangMem Conceptual Guide](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/)
- [LangGraph Store System](https://deepwiki.com/langchain-ai/langgraph/4.3-store-system)
- [LangGraph Long-Term Memory Docs](https://docs.langchain.com/oss/python/deepagents/long-term-memory)
- [CrewAI Memory Documentation](https://docs.crewai.com/en/concepts/memory)
- [Mem0 GitHub](https://github.com/mem0ai/mem0)
- [Mem0 Research Paper arXiv 2504.19413](https://arxiv.org/abs/2504.19413)
- [AWS Prescriptive Guidance - Memory Augmented Agents](https://docs.aws.amazon.com/prescriptive-guidance/latest/agentic-ai-patterns/memory-augmented-agents.html)
- [Claude Projects Ultimate Guide - aimaker.substack.com](https://aimaker.substack.com/p/ultimate-guide-to-claude-project-memory-system-prompt)
- [Claude Projects Guide - instituteofaistudies.com](https://www.instituteofaistudies.com/insights/how-to-use-claudes-projects)
