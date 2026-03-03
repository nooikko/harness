# Research: Agent Memory Architectures — Scoping, Isolation, and the Multi-Context Problem

Date: 2026-03-03

## Summary

This research surveys the state of the art in agent memory architectures with particular focus on the **memory isolation and scoping problem**: how do systems ensure that agent memories from one context (project, thread, channel) do not contaminate responses in another? Six major systems are covered — MemGPT/Letta, Mem0, LangGraph/LangMem, CrewAI, Generative Agents (Stanford), and A-Mem — plus several 2025 academic approaches (Memoria, MemOS). The research concludes with a synthesis directly applicable to the Harness multi-agent, multi-project, multi-channel architecture.

## Prior Research

- `2026-03-01-agent-identity-soul-memory-research.md` — Generative Agents formula + MemGPT architecture covered in depth
- `2026-03-01-ai-projects-memory-hierarchy-research.md` — project-level memory hierarchy, three-tier model, LangGraph namespace pattern

This document does NOT repeat those findings. It builds on them, focusing specifically on the **isolation problem** not covered previously.

---

## 1. MemGPT / Letta

### Architecture Summary

MemGPT treats the LLM context window as RAM and external storage as disk — an OS-style virtual memory hierarchy.

**Three memory tiers:**

| Tier | Analogy | Always In Context | Contents |
|------|---------|-------------------|----------|
| Core Memory | RAM | Yes | Persona block (5,000 chars) + Human block (5,000 chars). Agent-editable via tools. |
| Recall Memory | Fast disk | No | Full conversation history. Retrieved via text search (`conversation_search`). |
| Archival Memory | Cold storage | No | Unbounded semantic knowledge. Retrieved via embedding similarity (`archival_memory_search`). |

**Agent-Controlled Memory Tools (key MemGPT innovation):**
The agent itself calls tools to manage its own memory. It decides what to remember and forget — not a fixed external system. This makes persistence decisions contextually appropriate rather than rule-based.

### How It Handles Scoping / Isolation

**Short answer: per-agent, not per-context.** This is the critical limitation.

In the original MemGPT architecture, a single agent has one Core Memory block, one Recall Storage, and one Archival Storage. There is no built-in concept of a memory namespace or project scope. If the same agent is used across multiple conversation contexts, all memories land in the same archival store.

The **Letta evolution** (2025) addresses this partially through:
- **Memory Blocks** — the blocks can be swapped or replaced. You could implement project isolation by swapping the human block to a project-specific version.
- **Multi-agent shared blocks** — multiple agents can share the same block via `block_id`. One write, all agents see it.
- **Conversations API** — a "conversation" is a concurrent context for the same agent. Letta's explicit design decision: "experiences within a conversation can form memories which transfer across all conversations." They deliberately allow cross-conversation memory contamination within the same agent. Isolation requires separate agents.

**Official Letta guidance on isolation:** "If you want agents to accumulate memory across user sessions, use conversations. If you want memory to be isolated, create separate agents."

This means: for true project isolation in Letta, you need a separate agent instance per project. That may be acceptable for large projects but is impractical for many short-lived or ad-hoc contexts.

### Retrieval Strategy

- Core memory: always in context (no retrieval needed)
- Recall: text keyword search via `conversation_search(query)`
- Archival: embedding similarity via `archival_memory_search(query)`
- No importance scoring or recency decay built in (unlike Generative Agents)

### Documented Limitations

- **Session-based only:** "MemGPT typically treats context logs on a per-session basis, lacking non-linear, multi-axis cross-dialogue retrieval capabilities" (from benchmark comparison research)
- **No composite scoping:** No native per-project, per-thread, or per-channel filtering
- **Last-write-wins for shared blocks:** Multiple agents calling `memory_rethink` on the same block simultaneously causes lost updates
- **Token budget constraints:** Core Memory character limits (5,000 chars each block) mean the agent cannot keep everything important in context
- **Memory poisoning risk:** "If someone can poison your agent's long-term memory, they're not just affecting one conversation" — MemGPT's isolation is less explicit than Mem0 or LangMem

### Architecture Classification

Library + Service. MemGPT was originally a Python library. Letta is now a managed cloud service AND open-source framework.

### Applicability to Harness

**Moderate.** The dual-injection pattern (header before message + anchor after message) that Harness already implements mirrors MemGPT's core memory architecture. The agent-controlled memory tools concept is interesting but Harness already uses the `onAfterInvoke` hook pattern instead. The critical gap: MemGPT's lack of native project/channel scoping makes it a poor direct model for Harness's multi-context problem.

---

## 2. Mem0

### Architecture Summary

Mem0 is a managed memory layer (API service + open-source library) designed as a universal memory backend for any AI application. It implements a **capture-promote-retrieve** workflow.

**Four memory layers:**

| Layer | Lifetime | Scope | Contents |
|-------|----------|-------|----------|
| Conversation Memory | Single turn | In-flight messages | What was just said |
| Session Memory | Minutes to hours | Current task/channel | Short-lived task facts |
| User Memory | Weeks to forever | Person/workspace | Long-lived preferences |
| Organizational Memory | Permanent | Global | Shared context across agents |

**Storage backends:** Hybrid — vector database (Pinecone, Qdrant, Weaviate, Chroma, pgvector) + key-value database + optionally a graph database (Neo4j). When `add()` is called, Mem0 extracts relevant facts and distributes them across stores.

### How It Handles Scoping / Isolation

Mem0 has the **most explicit scoping model** of any system surveyed. The `add()` API accepts up to six scope identifiers:

```
user_id     — Individual identity. Long-term personalization anchor.
agent_id    — Agent-specific context.
app_id      — Application-level defaults.
run_id      — Session isolation. Short-lived. Expires when task completes.
org_id      — Organization-level shared context.
project_id  — Project-specific isolation.
```

These identifiers can be combined. Example: `add(messages, user_id="alex", project_id="proj_123", agent_id="assistant_7")` creates memories scoped to that exact combination.

**Isolation guarantee:** Memories are isolated at the storage level, not just at retrieval time. One scope's memories are never retrieved in another scope's context unless the query explicitly crosses scopes.

**Search filter behavior:** The `search()` call respects the same scope parameters. Search with `user_id="alex", project_id="proj_123"` returns only memories from that project for that user.

### Retrieval Strategy

- Vector similarity search for semantic relevance
- Metadata filtering by scope parameters (hard filtering before vector search)
- No documented recency decay or importance scoring in the public API (as of research date)
- The internal pipeline does run extraction, deduplication, and conflict detection when memories are added

### Documented Limitations

- **Managed service dependency:** The cloud API introduces latency and dependency on Mem0's infrastructure. Self-hosted option exists but requires vector DB setup.
- **Opaque pipeline:** The extraction, deduplication, and categorization steps are LLM-powered and not fully deterministic
- **No importance scoring at retrieval:** Unlike Generative Agents, there is no recency decay or importance weighting in retrieval — pure semantic similarity with metadata filters
- **project_id is a filter, not a namespace hierarchy:** There is no parent-child relationship between project_id values. Cannot easily query "all memories for this user across all projects"

### Applicability to Harness

**High for scoping model.** Mem0's `user_id + agent_id + project_id + run_id` combination is the closest match to Harness's requirements. The concept maps directly:
- `user_id` → Harness is single-user, this is implicit
- `agent_id` → Harness `Agent.id`
- `project_id` → Harness `Project.id`
- `run_id` → Harness `Thread.id`

The Mem0 scoping model can be replicated internally using PostgreSQL metadata fields on `AgentMemory` records without adopting Mem0 as a dependency.

---

## 3. LangGraph / LangMem

### Architecture Summary

LangGraph implements a two-level memory model:

1. **Short-term state (thread-scoped):** TypedDict state flowing through a graph, persisted via checkpointers, isolated by `thread_id`. One thread = one isolated conversation context.
2. **Long-term store (cross-thread):** A key-value store with **namespace tuples** enabling hierarchical isolation.

**LangMem** is the LangChain memory library built on top of this store.

**LangMem memory types:**
- **Semantic Memory** — facts and knowledge (collections or profiles)
- **Episodic Memory** — past experiences and successful patterns
- **Procedural Memory** — behavioral rules via system prompts that evolve

### How It Handles Scoping / Isolation

The namespace tuple is LangGraph's primary isolation mechanism:

```python
# Namespace examples:
("users", user_id)                           # User-scoped
("projects", project_id)                     # Project-scoped
("users", user_id, "projects", project_id)   # User + project composite
("agents", agent_id, "projects", project_id) # Agent + project composite
("memories", user_id)                        # The common pattern shown in docs
```

**Key properties:**
- Namespace can be any length tuple — there is no prescribed hierarchy
- Items stored with `(namespace, key)` addressing
- Search within a namespace is isolated by default — no cross-namespace bleed
- Vector search via `IndexConfig` for semantic retrieval within a namespace

**Thread isolation:** State changes in one `thread_id` do not affect others. The `thread_id` checkpointer is the gold standard for short-term context isolation.

**Cross-thread memory:** LangGraph explicitly supports "cross-thread memory" — the store allows sharing data between threads via namespace lookup. This is intentional and controllable: you opt in to cross-thread sharing, rather than having contamination happen by default.

**LangMem update patterns:**
- **Active/Conscious:** Updates during conversation (immediate, adds latency)
- **Background/Subconscious:** Processing between interactions (batch, no latency impact on main pipeline)

### Retrieval Strategy

- Primary: namespace filtering (deterministic, relational)
- Secondary: vector similarity within namespace (semantic)
- No built-in recency decay or importance scoring

### Documented Limitations

- **Namespace design burden on developer:** The framework provides the mechanism but not the policy. You must design your namespace hierarchy up front. There are no guardrails preventing contamination if you put everything under the same namespace.
- **LangMem is Python-only:** The LangGraph ecosystem is Python-first. No official TypeScript library for LangMem.
- **pgvector coupling:** The recommended backend is PostgreSQL + pgvector. The Harness project has explicitly rejected pgvector for Phase 3 vector search. However, LangGraph's namespace concept is backend-agnostic — the pattern is portable.
- **No importance scoring:** Pure semantic similarity + namespace filtering. No Generative Agents-style weighted scoring.

### Applicability to Harness

**High for namespace pattern.** The namespace tuple approach is directly adaptable to PostgreSQL metadata fields. Instead of a tuple-indexed store, Harness can add `projectId`, `threadId`, and `channelId` columns to `AgentMemory` and use WHERE clause filtering as the equivalent of namespace isolation. The isolation guarantee is identical.

---

## 4. Generative Agents (Stanford, 2023)

### Architecture Summary

The most academically rigorous memory system. 25 simulated agents in "Smallville" demonstrate believable human behavior over 48 simulated hours.

**Memory Stream:** Single append-only database of all memories. Each record:
```
content: string (natural language)
created_at: datetime
last_accessed_at: datetime  -- drives recency decay
importance: int (1-10, LLM-assigned at write time)
embedding: vector (for relevance)
```

Memory types stored in the same stream:
- **Observations** — raw perceptions
- **Reflections** — synthesized higher-order insights
- **Plans** — forward-looking intentions

**No namespace or scope.** Each agent has exactly one memory stream. Multi-context scoping was not a design concern because each agent in Smallville is a distinct person with a distinct context.

### Retrieval Formula

```
score = α·recency + β·importance + γ·relevance

recency   = 0.995^hours_since_last_access   (exponential decay)
importance = memory.importance_score / 10   (normalized, LLM-assigned at write)
relevance  = cosine_similarity(embed(query), memory.embedding)

All three normalized to [0,1] via min-max scaling.
α = β = γ = 1 (equal weights in reference implementation)
```

**Critical detail:** `last_accessed_at` updates on every retrieval. So frequently-accessed memories decay from their last retrieval time, not creation time. Memories that were important but haven't been accessed recently decay, creating natural "forgetting."

### Reflection Mechanism

**Trigger:** When sum of importance scores of last 100 perceived events exceeds 150 (fires ~2-3 times per simulated day).

**Process:**
1. Take last 100 memories
2. LLM generates "3 most salient high-level questions about these subjects"
3. Each question retrieves the top-k relevant memories as evidence
4. LLM synthesizes 3-5 insights per question, each cited to source memories
5. Insights stored as new memory objects with `sourceMemoryIds` pointers

This creates a **tree of reflections** — reflections can be built on top of previous reflections, enabling increasingly abstract understanding over time.

### Documented Limitations

1. **No scoping whatsoever** — all memories for an agent are global to that agent
2. **Retrieval failures** — agents sometimes fail to surface relevant memories despite having experienced the events
3. **Hallucination under pressure** — agents embellish knowledge beyond stored observations
4. **Memory bloat degrades planning** — as memory grows, agents increasingly pick atypical locations for activities
5. **Importance threshold is a hyperparameter** — the 150 threshold is empirically derived, not analytically principled
6. **Full vector search required** — the relevance component requires embeddings, which Harness currently lacks for Phase 3

### Applicability to Harness

**High for scoring formula, low for architecture.** The recency + importance + relevance formula is already implemented in Harness's `retrieve-memories.ts` (with the Phase 3 relevance component stubbed out pending Qdrant). The reflection mechanism is also implemented. What Harness currently lacks and Generative Agents does not provide is any scoping model — the Generative Agents paper simply doesn't address the problem of one agent running in multiple projects.

---

## 5. CrewAI Memory (2025)

### Architecture Summary

CrewAI's unified `Memory` class uses a **filesystem-path metaphor** for scoping. Memory paths look like directory paths.

**Scoping model:**
```
/agent/researcher          # Researcher agent's private memories
/project/alpha/architecture # Architecture decisions for Project Alpha
/project/beta/api          # API design for Project Beta
/shared/preferences        # Cross-agent shared preferences
```

**Memory record fields:**
```typescript
{
  content: string,
  scope: string,           // filesystem-style path
  categories: string[],    // LLM-inferred categories
  importance: float,       // 0-1 score
  source: string,          // "agent:researcher", "user:alice"
  private: boolean,        // private records only visible to matching source
  timestamp: DateTime,
  vector_embedding: float[]
}
```

**Key isolation mechanisms:**
- **Explicit scoping:** Agent receives `memory.scope("/agent/researcher")`, restricting operations to that subtree
- **MemorySlice:** A view across multiple disjoint scopes. Enables an agent to see `/project/alpha` AND `/shared/preferences` simultaneously while being isolated from `/project/beta`
- **Read-only access:** Shared scopes can be attached read-only (`read_only=True`), preventing writes
- **Private flag:** Records with `private=True` are only visible when the caller's source matches

**LLM-inferred scope assignment:** When saving without specifying scope, an LLM determines the most appropriate scope. The scope tree "grows organically from content."

**Default storage backend:** LanceDB (stored locally at `./.crewai/memory`). Custom backends supported.

**Deduplication:** When similar content is saved, an LLM decides whether to keep, update, delete, or insert. Intra-batch deduplication via vector similarity threshold.

### Retrieval Strategy

- Vector similarity within scoped view
- Metadata filtering by scope path prefix
- Importance score stored but not documented as part of retrieval ranking formula

### Documented Limitations

- **LLM-inferred scope adds latency:** Every memory write that doesn't specify a scope triggers an LLM call for scope inference
- **LanceDB is not PostgreSQL:** Harness uses PostgreSQL. LanceDB is a separate dependency.
- **Scope path design is unbounded:** No enforcement of scope paths — a poorly-designed deployment could create an inconsistent path hierarchy
- **No recency scoring:** The retrieval model doesn't include temporal decay

### Applicability to Harness

**High conceptually, low practically.** The path-based scoping metaphor is intuitive and maps well to the Harness problem. However, the LanceDB dependency is incompatible. The conceptual model (scoped reads/writes, MemorySlice across disjoint scopes, read-only shared access) is worth implementing natively in PostgreSQL using metadata columns rather than path strings.

---

## 6. A-Mem (Agentic Memory, 2025)

**arXiv: 2502.12110**

### Architecture Summary

A-Mem implements a **Zettelkasten-inspired memory** where each memory is an interconnected note rather than an isolated record.

**Memory note structure:**
```
content: string             (original interaction data)
timestamp: datetime         (when stored)
keywords: string[]          (LLM-generated)
tags: string[]              (LLM-generated categorical labels)
contextual_description: string  (LLM-generated rich semantic understanding)
embedding: vector           (for similarity)
links: string[]             (references to semantically related memories)
```

**Dynamic linking:** When a new memory arrives, the system finds top-k similar existing memories and an LLM evaluates whether they should be linked. Links create a graph structure on top of the flat list.

**Memory evolution:** New arrivals can trigger updates to existing memories — keywords, tags, and contextual descriptions of existing notes are updated to reflect new understanding.

**Retrieval:** Cosine similarity query → top-k candidates → linked memories are also included (link-following navigation).

### How It Handles Scoping / Isolation

**It doesn't.** A-Mem's entire contribution is the linking/evolution mechanism. There is no concept of scoping across projects or channels. All memories are in a single flat store (organized by semantic relationship, not by context boundary).

### Applicability to Harness

**Low for architecture, medium for concepts.** The link graph between memories is interesting — REFLECTION memories in Harness already store `sourceMemoryIds` which is the same idea. The `contextual_description` field (rich LLM-generated description per memory) is worth considering as a supplement to raw content storage. But A-Mem offers nothing for the isolation problem.

---

## 7. Memoria (2025)

**arXiv: 2512.12686**

### Architecture Summary

Memoria is a hybrid system combining session summarization and a weighted knowledge graph for personalized conversational AI.

**Components:**
1. **Session-level summarization:** Per-session summaries stored in SQLite3, indexed by `(session_id, username)`
2. **Knowledge Graph:** Triplets `(subject, predicate, object)` extracted from interactions, stored in ChromaDB with embeddings
3. **Recency weighting:** Exponential decay applied at retrieval time

**Weighted retrieval formula:**
```
normalized_weight = e^(-a * x_i) / Σ e^(-a * x_j)

where:
  a = decay rate (0.02 in experiments)
  x_i = normalized minutes since triplet creation (scaled to [0,1])
```

**Scoping:** Memories are filtered by `username` at retrieval time. `session_id` determines which session summary is loaded.

**Performance:** Achieved 38.7% latency reduction vs. full-context prompting while maintaining accuracy, with prompts under 400 tokens vs. 115,000 tokens for full-context.

### Documented Limitations

- **Single-user design:** No multi-agent or multi-project concept
- **No project isolation:** Username filtering is the only isolation mechanism
- **ChromaDB dependency:** Not PostgreSQL-native
- **No importance scoring at write time**

### Applicability to Harness

**Medium.** The knowledge graph triplet format is a higher-fidelity representation than Harness's current text-blob memories. The performance results (38.7% latency reduction) are compelling. However, the ChromaDB dependency and single-user scope limit direct adoption. The triplet pattern could be added to `AgentMemory.content` structure without requiring a graph database.

---

## 8. The Core Isolation Problem: Multi-Level Scope Design

### Problem Statement (Harness-Specific)

- 1 user
- Multiple agents (each with their own soul/identity)
- Multiple projects (Project A, Project B, etc.)
- Multiple channels (web UI, Discord)
- Multiple threads per project (many conversations in Project A)

Currently: `AgentMemory` records have only `agentId` FK. All memories for an agent are globally accessible regardless of which project or channel generated them.

**The contamination scenario:** Agent writes a memory in Project A about "prefer GraphQL over REST." When the same agent is used in Project B (a totally different domain, say, a mobile app), that GraphQL preference bleeds in even if it's irrelevant.

### How Surveyed Systems Would Solve This

| System | Isolation Mechanism | Granularity | Notes |
|--------|---------------------|-------------|-------|
| MemGPT/Letta | Separate agent instance per project | Per-agent | Requires N agents for N projects |
| Mem0 | `project_id` parameter in add/search | Per-project | Most explicit scoping model |
| LangGraph | Namespace tuple `(agent_id, project_id)` | Composite | Flexible, backend-agnostic |
| CrewAI | Path string `"/project/alpha"` | Hierarchical | Intuitive, LanceDB-dependent |
| Generative Agents | None | — | Not applicable |
| A-Mem | None | — | Not applicable |

### Industry Consensus Architecture

From the O'Reilly multi-agent systems research and broader 2025 literature:

1. **Memory must be scoped at the storage level, not retrieval time.** Metadata filtering at query time is insufficient as the sole isolation mechanism — it's too easy to misconfigure.

2. **Composite keys are the production pattern.** Every major production system uses composite identifiers: `(agent_id, project_id)` minimum, often also `(thread_id)` for thread-level associations.

3. **Isolation levels should be designed as a lattice:**

```
Thread-level memories (strongest isolation)
  └── Project-level memories (moderate isolation)
        └── Agent-level memories (cross-project personality continuity)
```

4. **Retrieval should query specific levels selectively.** A query in Thread T of Project P for Agent A should retrieve:
   - Thread memories from T (strongest signal, most contextually relevant)
   - Project memories from P (project-specific learned patterns)
   - Agent-level memories from A that are NOT scoped to any other project (personality/style continuity)
   - NOT: memories from other projects for Agent A

5. **Channel isolation is usually unnecessary.** The Mem0 and LangGraph literature do not distinguish Discord vs. web as isolation boundaries. Channel is an input/output adapter, not a memory scope. Memories generated via Discord and memories generated via web are semantically equivalent if they're in the same project+thread context.

---

## 9. Hybrid Architecture Pattern (Best of All Systems)

The strongest pattern from the literature combines three approaches:

### Layer 1: Relational Metadata Filtering (PostgreSQL)
Add scope columns to `AgentMemory`:

```sql
agentId    -- always present (agent identity anchor)
projectId  -- nullable, scope to project
threadId   -- nullable, scope to thread
scope      -- enum: AGENT | PROJECT | THREAD (explicitly typed)
```

The `scope` field explicitly marks what level a memory is "valid" at:
- `AGENT` scope: personality traits, communication style, cross-project preferences
- `PROJECT` scope: project-specific technical decisions, domain knowledge
- `THREAD` scope: in-progress context, session-specific facts

### Layer 2: Vector Similarity (Qdrant — Phase 3)
Within a scope-filtered result set, rank by semantic similarity to the query. The Generative Agents formula becomes:

```
score = recency + importance + relevance
```
where `relevance` is the vector similarity (currently Phase 3, stubbed).

### Layer 3: Importance + Recency Scoring (Already Implemented)
The existing `retrieve-memories.ts` scoring formula handles this. No change needed.

### Retrieval Query Design

When retrieving memories for Agent A in Project P, Thread T:

```sql
SELECT * FROM "AgentMemory"
WHERE "agentId" = A
  AND (
    -- Thread-level memories for this specific thread
    ("threadId" = T AND scope = 'THREAD')
    OR
    -- Project-level memories for this project
    ("projectId" = P AND scope = 'PROJECT')
    OR
    -- Agent-level memories with no project constraint (personality continuity)
    ("projectId" IS NULL AND scope = 'AGENT')
  )
ORDER BY importance_score DESC, created_at DESC
LIMIT 100
```

After SQL retrieval, apply recency + importance scoring, pick top 10-20.

### Write-Time Scope Assignment

When `scoreAndWriteMemory` writes a new `EPISODIC` memory, classify the scope based on content:
- Memories about preferences/style/behavior → `AGENT` scope (no projectId/threadId)
- Memories about technical facts, project decisions → `PROJECT` scope (include projectId)
- Memories about in-progress tasks, current state → `THREAD` scope (include threadId)

This classification can be LLM-guided (Haiku at write time, similar to current importance scoring) or rule-based (cheaper).

---

## 10. Key Tensions and Design Tradeoffs

### Tension 1: Isolation vs. Continuity

**Problem:** If Agent A has learned "this user prefers concise responses," should that preference carry across Project B where the user wants detailed reports?

**Industry resolution:** Use the explicit scope classification. "Prefers concise responses" is an AGENT-scoped memory — it reflects the user's general style. "Wants detailed weekly reports" is a PROJECT-scoped memory — it reflects a project-specific need. The retrieval query fetches both, with the project-scoped memory being more specific and typically higher importance.

**No silver bullet.** All systems surveyed acknowledge this tension and resolve it through scope classification rather than automatic detection.

### Tension 2: Channel Isolation (Discord vs. Web)

**Industry consensus:** Channel is an I/O adapter, not a memory boundary. Don't scope by channel. Memories from a Discord conversation about Project A and memories from a web conversation about Project A should share project scope.

**Exception:** If the user has fundamentally different personas across channels (formal on web, casual on Discord), a `channelPreference` memory at AGENT scope captures this without requiring channel isolation.

### Tension 3: Retroactive Scoping

**Problem:** Existing `EPISODIC` memories in Harness have no `projectId` or `threadId`. How to handle the migration?

**Practical resolution:** All existing memories default to `AGENT` scope (no projectId, no threadId). They remain accessible to all contexts. New memories written after the feature is deployed carry appropriate scope. No retroactive classification needed — the system improves incrementally.

### Tension 4: REFLECTION Memories Under Scoped Retrieval

**Problem (Phase 4 completion):** REFLECTION memories synthesize patterns across episodic memories. If EPISODIC memories are now scoped, should REFLECTION memories also be scoped?

**Recommendation:** REFLECTION memories should be written at the scope of their source memories. If a reflection synthesizes patterns from PROJECT A memories, it's a PROJECT A reflection. If it synthesizes cross-project patterns (agent-level), it's AGENT scope. The `checkReflectionTrigger` should be scope-aware, triggering per-scope rather than globally.

---

## Sources

- [Letta Introduction to Memory](https://docs.letta.com/concepts/memgpt/) — Confidence: HIGH
- [Letta Agent Memory Blog](https://www.letta.com/blog/agent-memory) — Confidence: HIGH
- [Letta Memory Blocks Guide](https://docs.letta.com/guides/agents/memory-blocks/) — Confidence: HIGH
- [Letta Multi-Agent Shared Memory](https://docs.letta.com/guides/agents/multi-agent-shared-memory) — Confidence: HIGH
- [Letta Conversations Blog](https://www.letta.com/blog/conversations) — Confidence: HIGH
- [MemGPT Paper](https://arxiv.org/abs/2310.08560) — Confidence: HIGH
- [Mem0 Memory Types](https://docs.mem0.ai/core-concepts/memory-types) — Confidence: HIGH
- [Mem0 Add Memories API](https://docs.mem0.ai/api-reference/memory/add-memories) — Confidence: HIGH
- [Mem0 GitHub](https://github.com/mem0ai/mem0) — Confidence: HIGH
- [LangGraph Cross-Thread Persistence](https://langchain-ai.github.io/langgraph/how-tos/cross-thread-persistence-functional/) — Confidence: HIGH
- [CrewAI Memory Documentation](https://docs.crewai.com/en/concepts/memory) — Confidence: HIGH
- [Generative Agents Paper (ar5iv)](https://ar5iv.labs.arxiv.org/html/2304.03442) — Confidence: HIGH
- [A-Mem Paper](https://arxiv.org/html/2502.12110v11) — Confidence: HIGH
- [Memoria Paper](https://arxiv.org/html/2512.12686v1) — Confidence: MEDIUM (Dec 2025, not yet widely cited)
- [O'Reilly Multi-Agent Memory Engineering](https://www.oreilly.com/radar/why-multi-agent-systems-need-memory-engineering/) — Confidence: HIGH
- [Tribe AI Context-Aware Memory 2025](https://www.tribe.ai/applied-ai/beyond-the-bubble-how-context-aware-memory-systems-are-changing-the-game-in-2025) — Confidence: MEDIUM
- [Qdrant Agentic Builders Guide](https://qdrant.tech/articles/agentic-builders-guide/) — Confidence: HIGH
- [MemOS arXiv](https://arxiv.org/abs/2505.22101) — Confidence: MEDIUM (2025 paper, emerging)
- [AI Memory Benchmark (Mem0 vs OpenAI vs LangMem)](https://guptadeepak.com/the-ai-memory-wars-why-one-system-crushed-the-competition-and-its-not-openai/) — Confidence: MEDIUM (community source)
- [MemoriesDB: Temporal-Semantic-Relational DB](https://arxiv.org/abs/2511.06179) — Confidence: MEDIUM (Nov 2025 paper)

---

## Gaps Identified

- **LangMem retrieval formula not found:** LangMem's Python-side retrieval scoring is not publicly documented in sufficient detail. It is known to combine vector similarity and namespace filtering, but whether it incorporates recency or importance is unknown. (Confidence: UNKNOWN)
- **Mem0 deduplication pipeline internals:** The extraction/conflict resolution LLM calls are opaque. The exact model used, latency, and cost-per-memory-write are not documented publicly. (Confidence: LOW)
- **MemOS practical adoption:** MemOS is a 2025 research system. No production deployments documented in available sources. (Confidence: LOW)
- **CrewAI Memory v2 stability:** The unified Memory class is documented as the 2025 version. Earlier versions had separate ShortTermMemory, LongTermMemory, EntityMemory classes. Migration path and stability are unclear. (Confidence: LOW)

---

## Recommendations for Next Steps

### Minimum viable scoping (recommended first step)

Add three nullable columns to `AgentMemory`:

```prisma
model AgentMemory {
  // ... existing fields ...
  projectId  String?
  project    Project?  @relation(fields: [projectId], references: [id])
  threadId   String?
  thread     Thread?   @relation(fields: [threadId], references: [id])
  scope      MemoryScope  @default(AGENT)
}

enum MemoryScope {
  AGENT    // Cross-project personality continuity
  PROJECT  // Project-specific knowledge
  THREAD   // Thread-specific in-progress context
}
```

Update `retrieve-memories.ts` to filter by scope hierarchy (Thread → Project → Agent).

Update `score-and-write-memory.ts` to accept `projectId` and `threadId` from the plugin context, and classify scope at write time.

### Phase 3 vector search integration

When Qdrant is added, the metadata filtering (agentId, projectId, threadId, scope) should be implemented as Qdrant **payload filters** applied BEFORE the vector search (not post-filter). Qdrant's ACORN algorithm (2025) supports efficient filtered HNSW queries — this is the recommended approach for combining vector similarity with scope filtering.

### REFLECTION memory scoping (Phase 4 completion)

Update `check-reflection-trigger.ts` to count unreflected EPISODIC memories per-scope (AGENT scope separately from PROJECT scope). Run a reflection when a scope's count exceeds 10. Write the resulting REFLECTION memories with the same scope as their source memories.

Give REFLECTION memories a scoring boost in `retrieve-memories.ts` — either a fixed multiplier (e.g., importance_score × 1.3) or a guaranteed N=2 reserved slots in the retrieval result set.

### Channel isolation: non-issue

Do not add `channelId` to `AgentMemory`. Discord and web are I/O adapters. Memories generated via either channel should share the same project and agent scope. The channel that generated a memory is irrelevant to its meaning.
