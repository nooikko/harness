# Agent Identity State

Which identity phases are complete, which are paused, and what each needs to proceed.

---

## Overview

The identity system is implemented as `@harness/plugin-identity`. It uses two hooks: `onBeforeInvoke` (soul + memory injection) and `onAfterInvoke` (episodic memory writing + reflection trigger). Five phases were planned; two are complete, one is partially active, one is paused, and one is in progress.

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
- `REFLECTION` — synthesized meta-insights across episodic memories (Phase 4, partially active)

File: `packages/plugins/identity/src/_helpers/retrieve-memories.ts`
File: `packages/plugins/identity/src/_helpers/score-and-write-memory.ts`

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

## Phase 4 — Reflection Cycle (PARTIALLY ACTIVE)

**What:** Periodic meta-reflection synthesizes patterns across episodic memories into `REFLECTION` type records. High-importance reflections (importance: 8) are injected into prompts alongside episodic memories.

**Status:** PARTIALLY ACTIVE — the reflection trigger IS wired into the live plugin as fire-and-forget in `scoreAndWriteMemory`. However, two gaps remain:

1. **`reflectionEnabled` is not checked.** The `AgentConfig.reflectionEnabled` flag exists in the schema but `scoreAndWriteMemory` does not consult it. Reflection triggers for all agents regardless of their config setting.
2. **REFLECTION memories are not prioritized in the header.** `retrieveMemories` returns memories by recency+importance score. REFLECTION records are treated identically to EPISODIC records — they are not given any special weighting or guaranteed injection.

**What is wired:**

File: `packages/plugins/identity/src/_helpers/score-and-write-memory.ts`, lines 92-97

```typescript
// Check if reflection should be triggered — fire-and-forget
void (async () => {
  const trigger = await checkReflectionTrigger(ctx.db, agentId);
  if (trigger.shouldReflect) {
    await runReflection(ctx, agentId, agentName, trigger.memories);
  }
})();
```

This runs after every episodic memory write. `checkReflectionTrigger` fires when >=10 unreflected EPISODIC memories exist since the last REFLECTION. `runReflection` uses Haiku to synthesize 3-5 insights and writes them as REFLECTION records with `sourceMemoryIds` linking back to episodic sources.

**What still exists (unchanged):**
- `MemoryType.REFLECTION` in schema
- `checkReflectionTrigger` — fires when >=10 unreflected EPISODIC memories exist since last REFLECTION
- `runReflection` — uses Haiku to synthesize 3-5 insights, writes them as REFLECTION records

Files:
- `packages/plugins/identity/src/_helpers/check-reflection-trigger.ts`
- `packages/plugins/identity/src/_helpers/run-reflection.ts`

**To complete Phase 4:**
1. Check `AgentConfig.reflectionEnabled` before triggering — skip if false or config doesn't exist
2. Give REFLECTION memories a boost in `retrieveMemories` scoring (or guarantee N slots in the returned set)

---

## Phase 5 — Scheduled Tasks via CronJob CRUD (IN PROGRESS)

**What:** Agents can have scheduled tasks — recurring or one-shot — that fire prompts into threads on a cron schedule or at a specific time. This replaces the original "per-agent heartbeat" concept.

**Status:** IN PROGRESS — the heartbeat abstraction was collapsed into the existing CronJob system. Every use case (daily digests, follow-up reminders, periodic maintenance) is modeled as a CronJob record with a required `agentId` FK.

**Design decision:** The original Phase 5 proposed `AgentConfig.heartbeatEnabled` + `AgentConfig.heartbeatCron` for a single heartbeat per agent. This was too narrow — an agent can have many threads and many scheduled tasks. The CronJob model already handles recurring scheduled prompts, so heartbeat was collapsed into CronJob CRUD with these additions:

- `agentId` (required) — every job runs in context of an agent
- `projectId` (optional) — auto-created threads inherit this
- `schedule` (nullable) — null for one-shot jobs
- `fireAt` (new) — one-shot fire time, mutually exclusive with `schedule`
- Lazy thread creation — if `threadId` is null, a thread is auto-created on first fire
- MCP tool `cron__schedule_task` — agents can create scheduled tasks during conversation

**What is being implemented:**
- Schema changes to CronJob (agentId, projectId, fireAt, nullable schedule)
- Full CRUD admin UI for CronJobs (create, edit, delete — not just toggle)
- Agent detail page integration (read-only list of scheduled tasks per agent)
- MCP tool for agents to self-schedule tasks
- Cron plugin changes for one-shot support and lazy thread creation

See: `docs/plans/2026-03-02-scheduled-tasks-prd.md` for the full design document.
See: `.claude/rules/cron-scheduler.md` for runtime behavior details.

---

## AgentConfig Model (EXISTS IN SCHEMA)

The model exists in `packages/database/prisma/schema.prisma`. No admin UI or server actions exist yet for managing AgentConfig records.

Current shape:
```prisma
model AgentConfig {
  id                String   @id @default(cuid())
  agentId           String   @unique
  agent             Agent    @relation(fields: [agentId], references: [id])
  memoryEnabled     Boolean  @default(true)
  reflectionEnabled Boolean  @default(false) // Phase 4 — not yet checked by plugin
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

The unique FK to `Agent` means one config per agent. The `Agent` model has `config AgentConfig?` relation.

**Note:** The `heartbeatEnabled` and `heartbeatCron` fields were removed as part of the scheduled tasks redesign. Per-agent scheduled tasks are now modeled as CronJob records with `agentId` FK instead of per-agent config flags. See Phase 5 above.

**Note:** `memoryEnabled` is not currently checked by the identity plugin. Memory writing happens for all agents with assigned threads regardless of this flag. Wiring this check is a straightforward enhancement to `scoreAndWriteMemory`.

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

## Phase Summary

| Phase | Status | Blocker |
|-------|--------|---------|
| 1 — Soul injection | COMPLETE | -- |
| 2 — Episodic memory | COMPLETE | -- |
| 3 — Vector search | PAUSED | Qdrant service + backend decision |
| 4 — Reflection cycle | PARTIALLY ACTIVE | reflectionEnabled not checked; REFLECTION memories not prioritized in header |
| 5 — Scheduled tasks (CronJob CRUD) | IN PROGRESS | Heartbeat collapsed into CronJob; schema + UI + MCP tool in progress |

---

## Key Files

| File | What it owns |
|------|-------------|
| `packages/plugins/identity/src/index.ts` | PluginDefinition — `onBeforeInvoke` + `onAfterInvoke` |
| `packages/plugins/identity/src/_helpers/load-agent.ts` | Thread -> Agent lookup (two-query: thread then agent) |
| `packages/plugins/identity/src/_helpers/retrieve-memories.ts` | Recency+importance scoring, top-N retrieval, lastAccessedAt update |
| `packages/plugins/identity/src/_helpers/score-and-write-memory.ts` | Haiku importance scoring + summary + EPISODIC write + reflection trigger |
| `packages/plugins/identity/src/_helpers/check-reflection-trigger.ts` | Counts unreflected EPISODIC memories; returns trigger decision |
| `packages/plugins/identity/src/_helpers/run-reflection.ts` | Haiku synthesis -> REFLECTION memory records |
| `packages/database/prisma/schema.prisma` | `Agent`, `AgentMemory`, `AgentConfig`, `MemoryType` enum |
| `apps/orchestrator/src/plugin-registry/index.ts` | Plugin ordering — identity must be index 0 |
