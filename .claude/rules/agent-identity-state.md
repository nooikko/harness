# Agent Identity State

Which identity phases are complete, which are paused, and what each needs to proceed.

---

## Overview

The identity system is implemented as `@harness/plugin-identity`. It uses two hooks: `onBeforeInvoke` (soul + memory injection) and `onAfterInvoke` (episodic memory writing + reflection trigger). Five phases were planned; two are complete, one is partially active, two are paused.

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

## Phase 5 — Per-Agent Heartbeat (PAUSED — intentionally deferred)

**What:** Each agent fires a scheduled "heartbeat" prompt to its own thread on a per-agent cron schedule. Enables agents to proactively consolidate context, update their own memory, or perform maintenance tasks without user interaction.

**Status:** PAUSED — both original blockers (AgentConfig schema + cron plugin) are now resolved. Implementation is intentionally deferred, not blocked.

**What exists:**
- `AgentConfig` model in schema with `heartbeatEnabled: Boolean` and `heartbeatCron: String?`
- `@harness/plugin-cron` is fully implemented and running
- No admin UI or server actions for AgentConfig yet

**To implement Phase 5:**
```
1. Read AgentConfig rows where heartbeatEnabled = true and heartbeatCron is non-null
2. For each agent: find the agent's thread (thread.agentId = agent.id)
3. Schedule a croner job with heartbeatCron expression
4. On trigger: ctx.sendToThread(thread.id, heartbeatPrompt)
```

This can live in either:
- The cron plugin's `start()` hook (alongside CronJob-based scheduling), OR
- The identity plugin's `start()` hook (agent-specific concern, self-contained)

---

## AgentConfig Model (EXISTS IN SCHEMA)

The model exists in `packages/database/prisma/schema.prisma` (line 210). No admin UI or server actions exist yet for managing AgentConfig records.

Current shape:
```prisma
model AgentConfig {
  id                String   @id @default(cuid())
  agentId           String   @unique
  agent             Agent    @relation(fields: [agentId], references: [id])
  memoryEnabled     Boolean  @default(true)
  reflectionEnabled Boolean  @default(false) // Phase 4 — not yet checked by plugin
  heartbeatEnabled  Boolean  @default(false) // Phase 5 — blocked on implementation
  heartbeatCron     String?                  // cron expression when heartbeat is wired
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

The unique FK to `Agent` means one config per agent. The `Agent` model has `config AgentConfig?` relation (line 184 of schema).

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
| 5 — Per-agent heartbeat | PAUSED (deferred) | Intentionally deferred; AgentConfig + cron plugin both exist |

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
