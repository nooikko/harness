# Agent Identity State

Which identity phases are complete, which are paused, and what each needs to proceed.

---

## Overview

The identity system is implemented as `@harness/plugin-identity`. It uses two hooks: `onBeforeInvoke` (soul + memory injection + bootstrap) and `onAfterInvoke` (episodic memory writing + reflection trigger), plus one MCP tool (`update_self`). Five phases were planned; three are complete, one is paused, and one is complete. Memory scoping (AGENT/PROJECT/THREAD) is implemented across all phases. Bootstrap onboarding is complete.

File: `packages/plugins/identity/src/index.ts`

---

## Phase 1 — Soul Injection (COMPLETE)

**What:** Agent fields `soul`, `identity`, `role`, `goal`, `backstory` are injected into every prompt for threads associated with an agent.

**How:** `onBeforeInvoke` calls `loadAgent(db, threadId)` — follows `thread.agentId` FK to the `Agent` record. If no agent is assigned to the thread, the hook is a no-op and the prompt is returned unchanged.

Two injections per prompt (dual injection):
- **Header** (before user message): soul + identity + relevant memories — establishes character before Claude reads the message
- **Anchor** (after user message): core principle extracted from soul — reinforces character after long code-heavy responses that may cause drift

```
[formatIdentityHeader(agent, memories)] \n\n---\n\n [prompt] \n\n---\n\n [formatIdentityAnchor(agent)]
```

File: `packages/plugins/identity/src/_helpers/format-identity-header.ts`
File: `packages/plugins/identity/src/_helpers/format-identity-anchor.ts`

---

## Phase 2 — Episodic Memory (COMPLETE)

**What:** After each invocation, the assistant response is scored for importance. If importance >= 6 (on a 1-10 scale), a summary is written as an `AgentMemory` record with `type: EPISODIC`.

**How:** `onAfterInvoke` fires `scoreAndWriteMemory` as fire-and-forget (`void`) — does not block the pipeline.

Scoring uses Haiku (`claude-haiku-4-5-20251001`) for cost efficiency. Both scoring and summarization are Haiku calls.

Memory retrieval scoring formula (recency + importance):
```
score = Math.pow(DECAY_RATE, hoursSince) + (memory.importance / 10)
DECAY_RATE = 0.995   // per hour
CANDIDATE_POOL = 100 // most recent memories scored, top 10 returned
```

`retrieveMemories` updates `lastAccessedAt` on every retrieved memory as a side effect — recently accessed memories decay from their access time, not creation time.

Memory types defined in schema:
- `EPISODIC` — normal conversation memories (Phase 2, active)
- `SEMANTIC` — factual assertions about the world (not yet written by any process)
- `REFLECTION` — synthesized meta-insights across episodic memories (Phase 4, complete)

File: `packages/plugins/identity/src/_helpers/retrieve-memories.ts`
File: `packages/plugins/identity/src/_helpers/score-and-write-memory.ts`

---

## Memory Scoping (COMPLETE)

**What:** 3-level scope hierarchy prevents cross-project memory contamination while preserving agent-level personality continuity.

**Scopes:**
- `AGENT` — cross-project personality memories (always retrieved regardless of context)
- `PROJECT` — project-specific memories (only retrieved when querying within that project)
- `THREAD` — thread-local memories (only retrieved for that specific thread)

**Schema:**
```prisma
enum MemoryScope { AGENT  PROJECT  THREAD }

model AgentMemory {
  scope      MemoryScope @default(AGENT)
  projectId  String?     // FK to Project (onDelete: SetNull)
  threadId   String?     // FK to Thread (onDelete: SetNull)
  // ... other fields
}
```

**How scope is determined:** During episodic memory writing, Haiku is asked to classify scope as part of the existing summarization prompt (zero additional LLM cost). The `classifyMemoryScope` helper validates Haiku's output against available context (e.g., THREAD without a threadId falls back to PROJECT; PROJECT without a projectId falls back to AGENT).

**How retrieval works:** `retrieveMemories` accepts an optional `context?: { projectId?, threadId? }` parameter. When context is provided, it builds an OR filter:
- Always includes `scope: 'AGENT'`
- Includes `scope: 'PROJECT', projectId` when projectId is provided
- Includes `scope: 'THREAD', threadId` when threadId is provided

When no context is provided (backward compatibility), all agent memories are returned regardless of scope.

**Prompt formatting:** `formatIdentityHeader` groups memories into subsections: "### Core" (AGENT), "### Project Context" (PROJECT), "### This Conversation" (THREAD).

**Scoped reflections:** `checkReflectionTrigger` and `runReflection` accept an optional `projectId`. Project-scoped EPISODIC memories trigger project-scoped REFLECTION records. Agent-scoped memories trigger agent-scoped reflections.

**Key files:**
- `packages/plugins/identity/src/_helpers/classify-memory-scope.ts` — fallback heuristic for scope classification
- `packages/plugins/identity/src/_helpers/retrieve-memories.ts` — scope-aware OR filter
- `packages/plugins/identity/src/_helpers/score-and-write-memory.ts` — Haiku scope classification + write
- `packages/plugins/identity/src/_helpers/format-identity-header.ts` — scope-grouped prompt sections

---

## Plugin Ordering Constraint

The identity plugin MUST be first in `ALL_PLUGINS`.

File: `apps/orchestrator/src/plugin-registry/index.ts`

```typescript
const ALL_PLUGINS: PluginDefinition[] = [
  identityPlugin,       // MUST be first — onBeforeInvoke chain starts here
  activityPlugin,
  contextPlugin,        // injects history after identity injects soul
  discordPlugin,
  webPlugin,
  cronPlugin,
  delegationPlugin,
  validatorPlugin,
  metricsPlugin,
  summarizationPlugin,
  autoNamerPlugin,
  auditPlugin,
  timePlugin,
  projectPlugin,
];
```

`onBeforeInvoke` is a chain hook: each plugin receives the previous plugin's output. Identity must run first so the soul header forms the foundation of the prompt. The context plugin then prepends conversation history above the soul-enriched prompt. If the order is reversed, history appears before the soul, weakening character consistency.

**If you reorder `ALL_PLUGINS`, identity must stay before context.**

---

## Phase 3 — Vector Search (PAUSED)

**What:** Semantic similarity search over `AgentMemory` records for better retrieval than recency+importance ranking alone.

**Status:** PAUSED — vector backend decision pending.

**Current retrieval** (Phase 2): recency decay + importance score over the 100 most recent memories. The `_query` parameter of `retrieveMemories` is unused — see the comment in source:
```typescript
// Phase 2: relevance omitted (no embeddings). Full scoring in Phase 3.
```

**When unblocked:** Implement as enhancement to `retrieveMemories` in `packages/plugins/identity/src/_helpers/retrieve-memories.ts`. Requires a Qdrant service for embedding storage and ANN search.

**Backend decision:** Qdrant only. pgvector was explicitly rejected for this project. Do not propose pgvector as an alternative.

---

## Phase 4 — Reflection Cycle (COMPLETE)

**What:** Periodic meta-reflection synthesizes patterns across episodic memories into `REFLECTION` type records. High-importance reflections (importance: 8) are injected into prompts alongside episodic memories.

**Status:** COMPLETE — reflection trigger is wired as fire-and-forget in `scoreAndWriteMemory`. `AgentConfig.reflectionEnabled` IS checked (defaults to `false`). REFLECTION memories receive a `REFLECTION_BOOST` of 0.3 in scoring and `MIN_REFLECTION_SLOTS` of 2 guaranteed slots in `retrieveMemories`.

**How it works:**

File: `packages/plugins/identity/src/_helpers/score-and-write-memory.ts`

```typescript
// Check if reflection should be triggered — fire-and-forget
void (async () => {
  const trigger = await checkReflectionTrigger(ctx.db, agentId, projectId);
  if (trigger.shouldReflect) {
    await runReflection(ctx, agentId, agentName, trigger.memories, projectId);
  }
})();
```

This runs after every episodic memory write. `checkReflectionTrigger` fires when >=10 unreflected EPISODIC memories exist since the last REFLECTION (scoped by project when projectId is provided). `runReflection` uses Haiku to synthesize 3-5 insights and writes them as REFLECTION records with `sourceMemoryIds` linking back to episodic sources. REFLECTION records inherit the scope of their source memories (project-scoped source → PROJECT scope).

**Key files:**
- `packages/plugins/identity/src/_helpers/check-reflection-trigger.ts` — fires when >=10 unreflected EPISODIC memories exist (project-scoped when projectId provided)
- `packages/plugins/identity/src/_helpers/run-reflection.ts` — Haiku synthesis -> REFLECTION records (inherits scope from source)
- `packages/plugins/identity/src/_helpers/retrieve-memories.ts` — REFLECTION_BOOST=0.3 + MIN_REFLECTION_SLOTS=2

---

## Phase 5 — Scheduled Tasks via CronJob CRUD (COMPLETE)

**What:** Agents can have scheduled tasks — recurring or one-shot — that fire prompts into threads on a cron schedule or at a specific time. This replaces the original "per-agent heartbeat" concept.

**Status:** COMPLETE — the heartbeat abstraction was collapsed into the existing CronJob system. Every use case (daily digests, follow-up reminders, periodic maintenance) is modeled as a CronJob record with a required `agentId` FK.

**Design decision:** The original Phase 5 proposed `AgentConfig.heartbeatEnabled` + `AgentConfig.heartbeatCron` for a single heartbeat per agent. This was too narrow — an agent can have many threads and many scheduled tasks. The CronJob model already handles recurring scheduled prompts, so heartbeat was collapsed into CronJob CRUD with these additions:

- `agentId` (required) — every job runs in context of an agent
- `projectId` (optional) — auto-created threads inherit this
- `schedule` (nullable) — null for one-shot jobs
- `fireAt` (new) — one-shot fire time, mutually exclusive with `schedule`
- Lazy thread creation — if `threadId` is null, a thread is auto-created on first fire
- MCP tool `cron__schedule_task` — agents can create scheduled tasks during conversation

**What was implemented:**
- Schema changes to CronJob (agentId, projectId, fireAt, nullable schedule)
- Full CRUD admin UI for CronJobs at `/admin/cron-jobs` (create, edit, delete, toggle)
- Agent detail page integration (read-only list of scheduled tasks per agent)
- MCP tool `cron__schedule_task` for agents to self-schedule tasks
- Cron plugin support for one-shot jobs (auto-disable after firing) and lazy thread creation

See: `docs/plans/2026-03-02-scheduled-tasks-prd.md` for the full design document.
See: `.claude/rules/cron-scheduler.md` for runtime behavior details.

---

## AgentConfig Model (COMPLETE)

The model exists in `packages/database/prisma/schema.prisma`. Both UI and server action are wired:
- **Server action:** `apps/web/src/app/(chat)/chat/_actions/update-agent-config.ts` — upserts AgentConfig for a given agent
- **UI:** `memoryEnabled` and `reflectionEnabled` checkboxes on the agent edit form (`edit-agent-form.tsx`)

Current shape:
```prisma
model AgentConfig {
  id                String   @id @default(cuid())
  agentId           String   @unique
  agent             Agent    @relation(fields: [agentId], references: [id])
  memoryEnabled     Boolean  @default(true)
  reflectionEnabled Boolean  @default(false)
  bootstrapped      Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

The unique FK to `Agent` means one config per agent. The `Agent` model has `config AgentConfig?` relation.

All three flags are checked by the identity plugin:
- **`memoryEnabled`** — If `config?.memoryEnabled === false`, `onAfterInvoke` returns early and no memory is written.
- **`reflectionEnabled`** — passed as `config?.reflectionEnabled ?? false` to `scoreAndWriteMemory`, which guards the reflection trigger. Defaults to false when no config exists (matching the schema default).
- **`bootstrapped`** — If `config?.bootstrapped === false`, `onBeforeInvoke` prepends a bootstrap prompt that instructs the agent to discover its identity through conversation. Set to `true` by the `identity__update_self` MCP tool.

---

## Agent Schema (Current)

File: `packages/database/prisma/schema.prisma`, line 164

```prisma
model Agent {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  version     Int      @default(1)
  enabled     Boolean  @default(true)

  soul        String   @db.Text
  identity    String   @db.Text
  userContext String?  @db.Text

  role        String?
  goal        String?
  backstory   String?  @db.Text

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  threads     Thread[]
  memories    AgentMemory[]
  config      AgentConfig?
  cronJobs    CronJob[]

  @@index([slug])
  @@index([enabled])
}
```

`Thread.agentId` is the FK used by `loadAgent` to find the agent for a given thread.

---

## Bootstrap Onboarding (COMPLETE)

**What:** Default agent discovers its own identity through natural conversation on first interaction.

**Seed data:** A default agent is seeded with slug `'default'`, name `'Assistant'`, generic soul/identity, and `AgentConfig.bootstrapped: false`. This is separate from the System agent (which handles automation). New threads with no explicit agent auto-assign the default agent via `createThread`.

**How it works:**
1. When `AgentConfig.bootstrapped === false`, the identity plugin injects a bootstrap prompt before the normal soul header
2. The bootstrap prompt instructs the agent to introduce itself, ask the user for a name and personality (one question at a time), and explore role/values
3. When ready, the agent calls `identity__update_self` to write its new name, soul, identity, role, goal, and/or backstory to the Agent record
4. The tool sets `bootstrapped: true` — the bootstrap prompt stops firing on subsequent invocations

**MCP Tool:** `identity__update_self` — always available, not just during bootstrap. Users can ask the agent to change its personality anytime. The tool resolves `agentId` from `meta.threadId`, updates only the fields provided, generates a slug from the name, and upserts `AgentConfig` with `bootstrapped: true`.

**Thread creation:** `createThread` in `apps/web/src/app/(chat)/chat/_actions/create-thread.ts` auto-assigns the default agent (by looking up `slug: 'default'`). If the default agent was deleted, threads are created without an agent (graceful fallback).

**Key files:**
- `packages/plugins/identity/src/_helpers/format-bootstrap-prompt.ts` — bootstrap prompt template
- `packages/plugins/identity/src/_helpers/update-agent-self.ts` — `update_self` tool handler
- `packages/database/prisma/seed.ts` — seeds default agent + AgentConfig

---

## Phase Summary

| Phase | Status | Blocker |
|-------|--------|---------|
| 1 — Soul injection | COMPLETE | -- |
| 2 — Episodic memory | COMPLETE | Memory scoping (AGENT/PROJECT/THREAD) implemented |
| 3 — Vector search | PAUSED | Qdrant service + backend decision |
| 4 — Reflection cycle | COMPLETE | Scoped reflections (project + agent level) |
| 5 — Scheduled tasks (CronJob CRUD) | COMPLETE | -- |

---

## Key Files

| File | What it owns |
|------|-------------|
| `packages/plugins/identity/src/index.ts` | PluginDefinition — `onBeforeInvoke` + `onAfterInvoke` + `update_self` tool |
| `packages/plugins/identity/src/_helpers/load-agent.ts` | Thread -> Agent lookup + threadProjectId extraction |
| `packages/plugins/identity/src/_helpers/retrieve-memories.ts` | Scope-aware retrieval, recency+importance scoring, REFLECTION boost |
| `packages/plugins/identity/src/_helpers/score-and-write-memory.ts` | Haiku importance scoring + scope classification + EPISODIC write + reflection trigger |
| `packages/plugins/identity/src/_helpers/classify-memory-scope.ts` | Fallback heuristic for scope classification (validates Haiku output) |
| `packages/plugins/identity/src/_helpers/check-reflection-trigger.ts` | Counts unreflected EPISODIC memories; project-scoped when projectId provided |
| `packages/plugins/identity/src/_helpers/run-reflection.ts` | Haiku synthesis -> REFLECTION records (inherits scope from source) |
| `packages/plugins/identity/src/_helpers/format-identity-header.ts` | Prompt header with scope-grouped memory sections |
| `packages/plugins/identity/src/_helpers/format-bootstrap-prompt.ts` | Bootstrap prompt template for first-time agent setup |
| `packages/plugins/identity/src/_helpers/update-agent-self.ts` | `update_self` MCP tool handler — agent writes its own identity |
| `packages/database/prisma/schema.prisma` | `Agent`, `AgentMemory`, `AgentConfig`, `MemoryType`, `MemoryScope` enums |
| `apps/orchestrator/src/plugin-registry/index.ts` | Plugin ordering — identity must be index 0 |
