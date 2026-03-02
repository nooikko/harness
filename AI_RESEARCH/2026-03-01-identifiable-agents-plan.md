# Identifiable Agents in Harness: Research Synthesis & Implementation Plan

**Date:** 2026-03-01
**Status:** Planning — not yet implemented
**Prior research referenced:**
- AI_RESEARCH/2026-03-01-agent-personality-memory-standards.md (industry frameworks)
- AI_RESEARCH/2026-03-01-agent-identity-soul-memory-research.md (white papers)
- AI_RESEARCH/2026-03-01-industry-gap-analysis-agent-orchestration.md (gap analysis)

---

## Executive Summary

We are building **identifiable agents** — named, persistent entities with distinct personality, values, and memory — that run inside Harness threads. The design draws primarily from:

1. **OpenClaw's soul-file architecture** — markdown files injected at every session turn define agent identity
2. **MemGPT's tiered memory model** — always-in-context persona block + external episodic/semantic storage
3. **Park et al.'s retrieval scoring** — recency + importance + relevance for memory retrieval
4. **Reflexion's self-reflection** — agents synthesize memories into higher-order insights
5. **Character Card V2's dual injection** — identity re-anchored at end of context to prevent drift

The result: every Harness thread is optionally associated with a named Agent. That Agent has a persistent soul (who it is), a curated memory (what it knows), and a reflection cycle (how it grows). Multiple agents can share a single Harness gateway — behaviorally isolated via separate identity definitions.

---

## Part 1: What OpenClaw Got Right

OpenClaw (GitHub: openclaw/openclaw) is a self-hosted AI agent gateway by Peter Steinberger that pioneered a markdown-first identity architecture. Agents are defined entirely by plain-text files — no code required to change who an agent is.

### The Workspace File System

| File | Role | Content |
|------|------|---------|
| `SOUL.md` | **The agent's constitution** — who they are, not what they do | Core truths, values, vibe, behavioral boundaries |
| `IDENTITY.md` | External presentation | Name, emoji, tagline, how others perceive the agent |
| `AGENTS.md` | Operational manifest | Boot sequence, memory conventions, tool usage rules |
| `USER.md` | Relationship to the current user | How to address them, what the agent knows about them |
| `TOOLS.md` | Workspace-specific tool guidance | Local context for available tools (camera names, SSH details, etc.) |
| `HEARTBEAT.md` | Autonomous behavior checklist | What the agent checks/does when no user is present |
| `BOOT.md` | Startup ritual | What happens when the gateway restarts |
| `memory/YYYY-MM-DD.md` | Daily episodic memory | Auto-written by the agent each session |
| `MEMORY.md` | Curated long-term memory | Agent-promoted important facts from daily logs |

**Key design principles:**
- Every file is plain markdown — human-readable, git-versionable, directly editable
- All files injected into the system prompt at session start (bootstrap phase)
- Size limits: 20,000 chars per file, 150,000 chars total
- Agents can rewrite their own files — the filesystem IS the memory
- Multi-agent isolation via separate workspace directories

### The SOUL.md Template (4 sections)

```markdown
## Core Truths
Foundational behavioral principles:
- Skip pleasantries and just help
- Have opinions and express them
- Try to figure it out before asking

## Boundaries
Non-negotiable guardrails:
- Protect private information
- Caution before external actions
- No deception or manipulation

## Vibe
Tone guidance:
- Concise, not verbose
- Authentic, not corporate
- Confident, not deferential

## Continuity
Recognition that each session starts fresh — SOUL.md is what creates
persistent identity across sessions. The agent may evolve this file
based on experience.
```

**Why SOUL.md works:** It creates behavioral consistency through *immutable principles* rather than *scripted responses*. The research (PCL 2025, 83.6% human eval win rate vs. baseline) confirms that structured identity schemas dramatically outperform generic persona descriptions.

---

## Part 2: Industry Standards Analysis

### Agent Personality — Framework Comparison

| Framework | Data Structure | Key Design Decision |
|-----------|---------------|---------------------|
| **CrewAI** | `role` + `goal` + `backstory` (string triplet) | Templated into system prompt; best for multi-agent coordination |
| **AutoGen** | `AgentID` (routing) + `system_message` (behavior) | Explicitly separates structural identity from behavioral persona |
| **LangGraph** | `ConfigurableSchema` with `system_prompt: str` | Swappable per tenant — same graph, different personality |
| **OpenAI Responses API** | `instructions` in system turn with labeled sections | Role/Objective → Personality/Tone → Constraints → Tools |
| **MemGPT** | `core_memory.persona` block (5,000 chars, always in context) | Agent-editable; persisted to disk; reloaded at session start |

**What research actually shows about personality:**
- Personas improve **behavioral consistency and UX** — not raw factual accuracy
- Adding personas does NOT reliably improve task performance (arxiv 2311.10054, 4 LLM families, 162 roles)
- "Chain of Persona" — asking the agent to self-question through its persona before responding — significantly outperforms just injecting the persona at context start
- **Concrete prohibitions** ("no fabrication", "no scope expansion") are the highest-value part of a personality definition

### Agent Memory — Type Taxonomy

| Type | Cognitive Analog | What It Stores | Storage Backend |
|------|-----------------|----------------|-----------------|
| **Working** | Working memory | Active conversation, immediate task state | In-context (context window) |
| **Episodic** | Autobiographical memory | Specific past events with timestamp, context, why | Timestamped log + vector DB |
| **Semantic** | General knowledge | Facts about users, domains, entities | Vector DB |
| **Procedural** | Skill memory | Rules, workflows, how-to | System prompt / weights |
| **Associative** | Associative memory | Relationships between entities | Knowledge graph (Graphiti/Neo4j) |

### The Park et al. Retrieval Formula (industry standard)

```
retrieval_score = normalize(recency) + normalize(importance) + normalize(relevance)
```

- **Recency:** `0.995 ^ hours_since_last_access` — exponential decay
- **Importance:** LLM-assigned 1–10 score at write time (assigned during storage, not retrieval)
- **Relevance:** Cosine similarity between query embedding and memory embedding

All three components normalized to [0, 1] and weighted equally. This is the most-validated retrieval approach in the literature.

### The Mem0 Three-Scope Model (production standard)

```
user memory    → persists across ALL sessions with a person (long TTL)
session memory → current conversation only (cleared on session end)
agent memory   → agent-specific learned behaviors (persists indefinitely)
```

Different TTLs, different ownership, different retrieval patterns. This is the key architectural insight from Mem0 that reduced token costs 90%+ in production.

### Reflexion Self-Reflection (highest-ROI memory investment)

Three-model loop:
1. **Actor** — generates output
2. **Evaluator** — scores it (success/failure + why)
3. **Self-Reflection** — verbal failure analysis stored in episodic buffer
4. Actor reads failure analyses on next attempt

Results: +22% AlfWorld, +20% HotPotQA, 91% HumanEval pass@1 vs GPT-4's 80%.

### Character Drift Prevention (Character Card V2)

**Dual injection pattern:**
1. Identity injected at **system prompt** (top of context)
2. Same identity injected via `post_history_instructions` (after conversation history)

The second injection re-anchors identity at the end of the context window, preventing character drift over long conversations. Community-discovered pattern, widely deployed, no academic citation needed.

---

## Part 3: Harness Implementation Plan

### 3.1 Core Concept

An **Agent** in Harness is a named, persistent entity with:
- A **soul** (who they are — values, tone, constraints)
- An **identity** (how they present — name, description, role)
- A **memory** (what they know — episodic and semantic)
- A **reflection cycle** (how they grow — periodic synthesis)

A **Thread** is a conversation. A Thread is optionally associated with an Agent. Without an Agent, threads work exactly as today (unchanged behavior — no regression). With an Agent, the pipeline injects that agent's soul and memory into every prompt.

### 3.2 Database Schema

```prisma
model Agent {
  id          String   @id @default(cuid())
  slug        String   @unique  // URL-safe identifier: "aria", "claude-prime"
  name        String            // Display name: "Aria"
  version     Int      @default(1)  // increment on soul changes
  enabled     Boolean  @default(true)

  // Soul — the agent's constitution (markdown)
  soul        String   @db.Text   // SOUL.md content: core truths, boundaries, vibe
  identity    String   @db.Text   // IDENTITY.md: name, role, how others perceive them
  userContext String?  @db.Text   // USER.md: relationship to users of this agent

  // Structural identity (CrewAI-inspired triplet, stored separately from soul)
  role        String?             // "Senior research assistant"
  goal        String?             // "Help the user think through hard problems deeply"
  backstory   String?  @db.Text   // Brief biographical grounding for the character

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  threads     Thread[]
  memories    AgentMemory[]
}

model Thread {
  // ... existing fields ...
  agentId     String?
  agent       Agent?   @relation(fields: [agentId], references: [id])
}

model AgentMemory {
  id              String   @id @default(cuid())
  agentId         String
  agent           Agent    @relation(fields: [agentId], references: [id])

  // Memory content
  content         String   @db.Text      // Natural language description
  type            MemoryType             // EPISODIC | SEMANTIC | REFLECTION

  // Retrieval scoring (Park et al.)
  importance      Int      @default(5)   // 1–10, assigned at write time by LLM
  embedding       Bytes?                 // pgvector embedding for relevance scoring

  // Temporal fields
  createdAt       DateTime @default(now())
  lastAccessedAt  DateTime @default(now())  // drives recency decay

  // Optional linkage
  threadId        String?  // which thread produced this memory
  sourceMemoryIds String[] // for reflections: which memories were synthesized
}

enum MemoryType {
  EPISODIC    // specific past event with context
  SEMANTIC    // general fact about a user, domain, or entity
  REFLECTION  // synthesized insight from multiple episodic memories
}
```

### 3.3 Plugin Architecture

New plugin: `@harness/plugin-identity`

**Hook:** `onBeforeInvoke` (runs after context plugin, before Claude invocation)

**What it does:**
1. Loads the thread's associated Agent (if any) from DB
2. Retrieves top-k memories via scored retrieval (recency + importance + relevance)
3. Constructs the identity section (SOUL.md + IDENTITY.md + memories)
4. Injects identity at the TOP of the prompt (before context plugin's output)
5. Also appends a `post_history_instructions` block at the END (dual injection for drift prevention)

**Plugin registration order:**
```typescript
const ALL_PLUGINS = [
  identityPlugin,   // NEW — injects agent soul + memory at start and end of prompt
  contextPlugin,    // existing — injects context files + conversation history
  discordPlugin,
  webPlugin,
  delegationPlugin,
  metricsPlugin,
  timePlugin,
];
```

Identity must run FIRST in the `onBeforeInvoke` chain so its soul is the foundation everything else builds on.

**New `onAfterInvoke` hook in identity plugin:**
- Extracts notable moments from Claude's output (LLM call to score importance 1–10)
- Writes high-importance moments as episodic memories (importance ≥ 6)
- Triggers reflection if importance sum of recent 50 memories exceeds ~100

### 3.4 Identity Injection Format

```
# [Agent Name] — Session Bootstrap
## Soul
[SOUL.md content]

## Identity
[IDENTITY.md content]

## Relevant Memory
[Top-k scored memories, formatted as bullet list with timestamps]
---
[Base prompt / context plugin output]
---
## [Agent Name] — Behavioral Anchor
[Abbreviated soul: 2-3 bullet constraints, re-stated]
Remember: you are [Agent Name]. Your core principle: [first core truth from SOUL.md].
```

The bottom anchor block is the "post_history_instructions" equivalent — it re-anchors identity after the context window has been filled with conversation history.

### 3.5 Memory Retrieval Implementation

```typescript
// Scored retrieval (Park et al. formula)
const retrieveMemories = async (agentId: string, query: string, limit = 10) => {
  const queryEmbedding = await embed(query);
  const recent = await db.agentMemory.findMany({
    where: { agentId },
    orderBy: { lastAccessedAt: 'desc' },
    take: 100,  // candidate pool
  });

  return recent
    .map(memory => {
      const hoursSince = (Date.now() - memory.lastAccessedAt.getTime()) / 3600000;
      const recency = Math.pow(0.995, hoursSince);         // exponential decay
      const importance = memory.importance / 10;           // normalize 1-10 to 0-1
      const relevance = cosineSimilarity(queryEmbedding, memory.embedding);
      const score = recency + importance + relevance;       // equal weight
      return { memory, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ memory }) => memory);
};
```

### 3.6 Memory Write — Importance Scoring

Every `onAfterInvoke`, the identity plugin:

1. Sends the Claude output to a fast LLM call:
   ```
   "Rate the importance of this conversation moment for [Agent Name]'s long-term memory.
   Scale 1–10 where 1 = mundane exchange, 10 = significant event that shapes their
   understanding or relationships. Output only the number."
   ```
2. If score ≥ 6: write an `EPISODIC` memory with the scored importance
3. If score ≥ 9: also write a `SEMANTIC` memory (entity fact or relationship)
4. Update `lastAccessedAt` on all memories retrieved during this invocation

### 3.7 Reflection Cycle

Trigger: when importance sum of the last 50 memories exceeds 100 (average importance > 2).

Reflection process (async, non-blocking):
1. Fetch the 50 most recent episodic memories
2. Ask Claude: "What are the 3 most important things [Agent Name] has learned recently? What patterns or insights emerge?"
3. Store each insight as a `REFLECTION` memory with `sourceMemoryIds` pointing to the contributing episodes
4. `importance` of reflections defaults to 8 (they are already high-signal)

This mirrors the Park et al. mechanism: reflections compress episodic noise into durable semantic knowledge.

### 3.8 Web UI Requirements

**Agent Management Page** (`/agents`):
- List all agents (name, slug, enabled, thread count)
- Create agent form: name, slug, soul (markdown editor), identity (markdown editor), role, goal, backstory
- Edit agent (version-increments on soul change)
- Per-agent memory browser: list memories, filter by type, view importance scores, delete

**Thread Creation:**
- Optional agent selector when starting a new thread
- Thread header shows agent name/identity when associated

**Identity Editor:**
- Split-pane markdown editor for SOUL.md and IDENTITY.md content
- Live preview showing how the injection will look
- "Chain of Persona" test: prompt the agent with a test question and see response through its soul

### 3.9 The `AgentConfig` Database Table

Following the existing `PluginConfig` pattern for runtime enable/disable:

```prisma
model AgentConfig {
  id       String  @id @default(cuid())
  agentId  String  @unique
  enabled  Boolean @default(true)
  // Per-agent feature flags
  memoryEnabled     Boolean @default(true)
  reflectionEnabled Boolean @default(true)
  heartbeatEnabled  Boolean @default(false)
  heartbeatCron     String? // cron expression for autonomous behavior
}
```

---

## Part 4: Implementation Phases

### Phase 1 — Identity Foundation (MVP)
**Goal:** Threads can be associated with named agents that have persistent souls.

1. Add `Agent` model to Prisma schema (slug, name, soul, identity, role, goal, backstory)
2. Add `agentId` FK to `Thread` model
3. Create `@harness/plugin-identity` with `onBeforeInvoke` hook
4. Implement dual injection (soul at top + anchor at bottom)
5. Web UI: agent CRUD + thread agent selector
6. Tests: identity injection format, agent lookup, thread association

**Definition of done:** Create an agent named "Aria" with a soul, start a thread with Aria, verify soul injected in prompt, verify behavioral consistency across sessions.

### Phase 2 — Episodic Memory
**Goal:** Agents remember notable moments across sessions.

1. Add `AgentMemory` model (content, type, importance, threadId)
2. Importance scoring in `onAfterInvoke` (lightweight LLM call, haiku model)
3. Memory retrieval in `onBeforeInvoke` (Park et al. scoring, no embeddings yet — text search only)
4. Web UI: memory browser per agent
5. Tests: importance scoring, memory storage, retrieval scoring formula

**Defer:** Embeddings for vector similarity (use recency + importance only in Phase 2; add relevance in Phase 3)

### Phase 3 — Semantic Memory + Retrieval
**Goal:** Agents build a knowledge base about users and domains.

1. Add pgvector extension to PostgreSQL
2. Add `embedding` column to `AgentMemory`
3. Implement embedding generation on memory write (Voyage AI or Claude embeddings)
4. Full Park et al. retrieval with cosine similarity
5. Semantic memory extraction (entity facts, user preferences)
6. Tests: embedding generation, full scored retrieval

### Phase 4 — Reflection Cycle
**Goal:** Agents synthesize raw memories into durable insights.

1. Reflection trigger logic (importance sum threshold)
2. Async reflection process (non-blocking — fires in background after `onAfterInvoke`)
3. Store reflections with source memory linkage
4. Web UI: reflection timeline showing how agent understanding evolves
5. Tests: trigger logic, reflection synthesis quality

### Phase 5 — Autonomous Behavior (Heartbeat)
**Goal:** Agents can act proactively on a schedule.

1. Cron scheduler in identity plugin (uses `AgentConfig.heartbeatCron`)
2. Heartbeat message triggers `sendToThread` on a dedicated thread
3. `HEARTBEAT_OK` response pattern (silent swallow)
4. Web UI: heartbeat configuration + log viewer

---

## Part 5: Key Design Decisions

### What We're NOT Building (explicitly out of scope)
- **No vector database infrastructure** in Phase 1-2 — plain PostgreSQL + text search first
- **No agent-to-agent messaging** — agents are isolated by thread; delegation is already handled by the delegation plugin
- **No file-system SOUL.md** — we store in PostgreSQL (not files), because Harness is a multi-agent gateway and needs DB-backed CRUD
- **No fine-tuning** — soul injection via system prompt is sufficient; fine-tuning is a Phase 6+ consideration
- **No separate agent runtime** — agents run on the same handleMessage pipeline; identity plugin transforms the prompt

### Why Database Over Files (divergence from OpenClaw)
OpenClaw uses files because it's a single-process, CLI-first tool — the agent runtime and the "UI" (terminal) share a filesystem. Harness is different: the web app and the orchestrator are separate processes, and the web app needs to read/write agent identity through server actions. PostgreSQL is the shared layer they both already speak. Additionally:
- CRUD API for the web UI (server actions → Prisma → DB)
- Everything else in Harness is already in Postgres — no new infrastructure
- Version history (soul versioning via `version` field)
- Query patterns (find all threads for agent X, memory browser per agent)
- ACID consistency for memory writes

### AutoGen's Key Insight: Structural Identity ≠ Behavioral Persona
Following AutoGen's separation:
- **Structural identity** = `Agent.slug`, `Agent.id` — used for routing, DB lookups, log correlation
- **Behavioral persona** = `Agent.soul` + `Agent.identity` — injected into prompts

These are separate columns, separate concerns. You can change the slug without changing the soul.

### The "Chain of Persona" Principle (PCL 2025)
Before generating responses, the agent should briefly self-check through its persona. We implement this by including in the soul injection:

```
Before responding, briefly consider: given who you are and what you stand for, what is the right response here?
```

This "Chain of Persona" approach is what drove the 83.6% human eval win rate in the PCL paper. It's a single sentence but it activates structured identity processing vs. just pattern-matching on the injected text.

---

## Part 6: Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Soul injection bloats context window | HIGH | MEDIUM | Size cap (5,000 chars for soul + 3,000 chars for memories); truncate with marker |
| Importance scoring adds latency | MEDIUM | LOW | Fire async in `onAfterInvoke`; use haiku model; cache for 60s |
| Character drift in long threads | MEDIUM | MEDIUM | Dual injection (anchor at end); reflection cycle refreshes semantic memory |
| Memory bloat over time | HIGH | LOW | Importance threshold (only write if ≥ 6/10); decay removes low-relevance memories from retrieval |
| Multiple agents same thread | LOW | HIGH | One agent per thread — enforced at schema level (`Thread.agentId` is nullable but singular) |
| Identity plugin breaks non-agent threads | LOW | HIGH | Guard: `if (!thread.agentId) return prompt` — zero impact on existing threads |

---

## Appendix: File References

When implementing:

- Plugin contract types: [packages/plugin-contract/src/index.ts](packages/plugin-contract/src/index.ts)
- Plugin registration: [apps/orchestrator/src/plugin-registry/index.ts](apps/orchestrator/src/plugin-registry/index.ts)
- Context plugin (model for identity plugin): [packages/plugins/context/src/index.ts](packages/plugins/context/src/index.ts)
- Prisma schema: [packages/database/prisma/schema.prisma](packages/database/prisma/schema.prisma)
- Database exports: [packages/database/src/index.ts](packages/database/src/index.ts)
- Web actions pattern: [apps/web/src/app/(chat)/chat/_actions/send-message.ts](apps/web/src/app/(chat)/chat/_actions/send-message.ts)
