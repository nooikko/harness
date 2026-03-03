# Agent Memory Scoping for Persistent Multi-Context Agents

**Date:** 2026-03-02
**Status:** Complete
**Problem:** Single agent, multiple threads/projects/channels — episodic memories from one domain contaminate others

---

## The Problem in Concrete Terms

Harness has:
- One human user (not multi-tenant — no user isolation concern)
- Multiple named agents, each with identity/soul (e.g., "Dev Assistant," "Dog Food Advisor")
- Each agent accumulates `AgentMemory` records (type: `EPISODIC`) after conversations, scored by importance
- An agent runs across many threads: coding threads on Project A, coding threads on Project B, casual channels on Discord, dog food discussions on web
- Currently: `AgentMemory` is scoped only to `agent.id` — ALL memories from ALL threads for that agent are pooled together and injected into every prompt

**Specific failure modes this causes:**

1. **Domain bleed**: A memory "User prefers tabs over spaces in TypeScript" from a Project A coding thread gets injected into a dog food discussion thread — semantically irrelevant, wastes context window tokens.
2. **Project cross-contamination**: "User wants to use Prisma 6 not Drizzle for Project A" gets injected when talking about Project B (which uses Drizzle intentionally).
3. **Memory pool explosion**: As the agent works across many projects over months, the total memory pool grows. Even with recency decay, high-importance older memories from unrelated projects continue to surface.
4. **Channel confusion**: Discord casual channel memories ("User likes short answers") contaminate web chat threads where the user expects detailed technical explanations.

---

## Prior Research to Cross-Reference

- `AI_RESEARCH/2026-03-01-ai-projects-memory-hierarchy-research.md` — comprehensive analysis of three-tier memory model (global → project → thread), Claude.ai/ChatGPT Project implementations, LangGraph namespace patterns, Mem0 entity scoping. This is the foundation.
- `AI_RESEARCH/2026-03-01-agent-workspace-isolation-patterns.md` — environment/filesystem isolation; not directly applicable to memory scoping but confirms thread-ID-as-isolation-key as the canonical LangGraph pattern.

---

## Framework-by-Framework Analysis

### 1. Letta / MemGPT

**Source:** [Letta Blog: Agent Memory](https://www.letta.com/blog/agent-memory), [Memory Blocks](https://www.letta.com/blog/memory-blocks)
**Confidence:** HIGH (official Letta documentation)

**Memory architecture:**
Letta (formerly MemGPT) organizes memory into four tiers:
1. **Core Memory** (in-context, "RAM"): always-loaded memory blocks with labels (e.g., "human," "persona," "knowledge"). Character limit enforced. Agent can self-edit.
2. **Recall Memory** (out-of-context): complete conversation history, searchable via semantic/keyword search. Used when session context is missing.
3. **Archival Memory** (out-of-context): explicitly formulated knowledge in external databases (vector or graph). Accessed via agent tool calls.
4. **Message Buffer**: recent conversation messages.

**How scoping works:**
Letta does NOT provide per-conversation or per-project memory isolation natively. Memory blocks are scoped to the **agent entity**, not to conversations within that agent. All conversations a Letta agent has share the same core/recall/archival memory pool.

**Multi-agent shared memory:** Letta's key feature is cross-agent memory sharing — multiple agents can share the same memory block (identified by `block_id`). This enables a background "memory manager" agent to update the primary agent's core memory blocks while the primary agent is idle.

**Heartbeat / periodic consolidation:**
In the legacy MemGPT architecture, agents used a `request_heartbeat` parameter on tool calls to chain multi-step operations. A "sleep-time agent" could run consolidation during idle periods using `memory_rethink`. In Letta V1 (current), heartbeats are deprecated — agents use native model reasoning instead.

**Relevance to Harness:**
Letta's model most closely matches Harness's current architecture: a single agent with a pooled memory store. Letta does NOT solve the cross-context contamination problem by default — it relies on semantic retrieval to surface relevant memories. This is a known limitation: "MemGPT lacks project-level compartmentalization." (Serokell: Design Patterns for Long-Term Memory)

---

### 2. LangGraph / LangMem

**Source:** [LangGraph Memory Overview](https://docs.langchain.com/oss/python/langgraph/memory), [LangGraph Long-Term Memory Launch](https://blog.langchain.com/launching-long-term-memory-support-in-langgraph/)
**Confidence:** HIGH

**Memory architecture:**
LangGraph has an explicit two-tier separation:

- **Short-term (thread-scoped)**: Conversation state persisted via checkpointers, keyed by `thread_id`. Different `thread_id` values create completely isolated conversation contexts. This is mandatory — no cross-thread visibility by design.
- **Long-term (cross-thread)**: A `BaseStore` key-value system with hierarchical namespace tuples. Items persist across threads and can be retrieved from any thread.

**Namespace structure:**
```python
# Tuples as hierarchical namespaces
("users", user_id)                    # user-scoped (across all their convos)
("projects", project_id)              # project-scoped
("agents", agent_id, "episodic")      # agent episodic memories
("agents", agent_id, "projects", project_id, "episodic")  # agent+project scoped
```

The store enables **semantic retrieval** via vector search (PostgreSQL/pgvector or other backends) when `IndexConfig` is attached. Keys within a namespace are unique identifiers; values are JSON documents.

**LangMem** (the companion library) extends this with typed memory operations (upsert, search, delete) and three memory types: semantic (facts), episodic (experiences), procedural (behavioral instructions/prompts). LangMem namespaces follow the same tuple pattern.

**Scoping recommendation from LangGraph docs:**
> "Namespaces often include user or org IDs or other labels that make it easier to organize information."

LangGraph's **canonical scoping approach for a Harness-like system** would be:
- Thread-scoped state = conversation history (via checkpointers)
- Agent+project episodic memory = namespace `("agents", agent_id, "projects", project_id, "episodic")`
- Agent global episodic memory = namespace `("agents", agent_id, "episodic")`
- At retrieval time: query **both** namespaces, merge results by relevance score

**Cross-contamination prevention:**
LangGraph explicitly prevents cross-thread bleeding via thread-scoped checkpointers. Long-term memory is isolated by namespace — querying `("agents", "dev-assistant", "projects", "project-a", "episodic")` returns zero results from Project B. This is by construction, not by filter.

**Heartbeat/consolidation:**
LangMem documents a "background processing" pattern — memories are consolidated in a separate async pass after conversations end, not inline. This is the `background=True` mode.

---

### 3. Mem0

**Source:** [Mem0 Entity-Scoped Memory](https://docs.mem0.ai/platform/features/entity-scoped-memory)
**Confidence:** HIGH (official documentation)

**Memory architecture:**
Mem0 partitions memories across four dimensions with strict null isolation:

| Identifier | Meaning |
|-----------|---------|
| `user_id` | Persistent persona or account |
| `agent_id` | Distinct agent persona or tool |
| `app_id` | White-label app or product surface |
| `run_id` | Short-lived flow or conversation thread |

**Critical isolation design:**
> "Passing only `{"user_id": "alice"}` automatically restricts results to records where `agent_id`, `app_id`, and `run_id` are null."

This means: each combination of identifiers forms an independent memory partition. Querying `agent_id="dev-assistant"` + `run_id="thread-abc"` returns ONLY memories tagged with that exact combination.

**For multi-project scoping in Harness, the Mem0 pattern would use:**
- `agent_id` = agent slug (e.g., `"dev-assistant"`)
- `app_id` = project ID (e.g., `"project-a"`)
- `run_id` = thread ID for session-level memories

**Mem0's known limitation:**
> "In multi-agent setups where multiple agents share the same userId, Agent A's memories are recalled for Agent B and vice versa, breaking domain isolation."

The solution is always explicit identifier tagging — never relying on implicit sharing.

**Retrieval recommendation (from Mem0 docs):**
For a context like "user is asking a coding question in Project A thread":
1. Query `agent_id="dev-assistant"` + `app_id="project-a"` (project memories)
2. Query `agent_id="dev-assistant"` with no `app_id` (global agent memories)
3. Merge and re-rank by relevance + recency
4. Do NOT include memories from other projects

---

### 4. CrewAI

**Source:** [CrewAI Memory Docs](https://docs.crewai.com/en/concepts/memory)
**Confidence:** HIGH

**Memory architecture:**
CrewAI implements a tree-based hierarchical scope system. Memory records contain:
- `scope`: filesystem-path-like string (e.g., `/project/alpha`, `/agent/researcher`)
- `categories`: LLM-inferred tags
- `importance`: float 0–1
- `private`: boolean
- Vector embedding for semantic search

**Scoping patterns:**
- `MemoryScope("/agent/researcher")`: restricts all operations to that subtree — read+write isolation
- `MemorySlice(["/agent/researcher", "/product/docs"])`: read-only access to multiple scopes simultaneously without being confined to one branch

**LLM-inferred scoping:**
CrewAI's most interesting feature: when saving a memory without specifying a scope, the LLM analyzes the content and suggests the optimal placement. The scope tree grows organically based on agent usage.

**Recommended CrewAI pattern for Harness-equivalent:**
```
/agent/{agent_slug}/global/         # agent-wide memories (personality, user preferences)
/agent/{agent_slug}/project/{id}/   # project-scoped episodic memories
/agent/{agent_slug}/thread/{id}/    # session-level (usually ephemeral)
/agent/{agent_slug}/channel/{id}/   # Discord vs. web channel preferences
```

Retrieval uses a `MemorySlice` that reads from global + current project simultaneously.

**Storage:** LanceDB (default), with custom backend support.

---

### 5. OpenAI Assistants API

**Source:** [OpenAI Assistants API Deep Dive](https://platform.openai.com/docs/assistants/deep-dive), [DZone Thread Guide](https://dzone.com/articles/openai-assistants-api-threads-guide)
**Confidence:** HIGH

**Memory architecture:**
OpenAI Assistants API uses **complete thread isolation** as its sole memory model:
- Each `Thread` contains all messages for a conversation
- Threads are scoped to the API Project they're created in
- There is NO cross-thread memory in the Assistants API — each thread starts fresh (or with explicit context injection)
- Vector Stores can be attached to threads for file-based RAG retrieval

**The OpenAI model: no persistent episodic memory by default.**
The user is responsible for injecting relevant context from past threads manually. This is the maximally conservative approach — zero contamination risk, but also zero automatic learning.

**For cross-thread memory**, OpenAI's newer Responses API (separate product) allows memory via the `store=true` parameter, but this is user-level global memory, not project-scoped.

**Relevance:** OpenAI's pattern is the "null hypothesis" — complete isolation at the cost of agents never learning. Not directly applicable to Harness's use case of persistent episodic memory.

---

### 6. Amazon Bedrock AgentCore

**Source:** [AgentCore Memory Organization](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-organization.html), [Episodic Memory Strategy](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/episodic-memory-strategy.html)
**Confidence:** HIGH (official AWS documentation)

**Memory architecture:**
AgentCore separates short-term and long-term memory with explicit namespace paths:

```
/strategy/{memoryStrategyId}/actor/{actorId}/session/{sessionId}/
```

- **Actor** = entity like a user or agent instance
- **Session** = single conversation
- **Strategy** = memory type (episodic, semantic, etc.)

**Episode scoping rule:**
> "Regardless of the namespace you choose to store episodes in, episodes are always created from a single session."

Episodes are session-bound by design. Reflections (synthesized patterns) can aggregate across episodes at actor or strategy level.

**Namespace granularity levels:**
1. Most granular: `/strategy/{id}/actor/{actorId}/session/{sessionId}/` — per-session
2. Actor-level: `/strategy/{id}/actor/{actorId}/` — all sessions for this actor
3. Strategy-level: `/strategy/{id}/` — all actors
4. Global: `/` — everything

**For Harness:** AgentCore's namespace model maps cleanly to:
- `actor` = agent slug
- An additional custom dimension would be needed for "project" — perhaps as a sub-namespace under actor

---

### 7. AutoGen (Microsoft)

**Source:** [AutoGen Memory and RAG](https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/memory.html), [AutoGen + Mem0 Integration](https://microsoft.github.io/autogen/0.2/docs/ecosystem/mem0/)
**Confidence:** MEDIUM (documentation is somewhat sparse; memory is mostly delegated to integrations)

**Memory architecture:**
AutoGen does not implement its own memory system. It delegates long-term memory to integrations:
- **Mem0**: recommended for user/agent/session-scoped episodic memory
- **Zep**: user/group/session management with automated data purges
- **Custom memory implementations** via the `Memory` protocol

AutoGen agents support: user memory (persistent across all sessions), session memory (current conversation), agent memory (agent-specific knowledge).

**Key insight:** Microsoft explicitly recommends external memory services over building in-framework. AutoGen treats memory as an external dependency, not a core concern.

---

### 8. Qdrant (Vector Backend)

**Source:** [Qdrant Multitenancy Guide](https://qdrant.tech/documentation/guides/multitenancy/), [Qdrant Agentic Builders Guide](https://qdrant.tech/articles/agentic-builders-guide/)
**Confidence:** HIGH (official Qdrant documentation)

**This is relevant because Harness has Qdrant planned as the vector backend for Phase 3 (Vector Search).**

**Qdrant's recommended multi-tenant pattern:**
> "In most cases, you should only use a single collection with payload-based partitioning."

```json
// Payload structure per memory point
{
  "agent_id": "dev-assistant",
  "project_id": "project-a",
  "thread_id": "thread-xyz",
  "memory_type": "EPISODIC",
  "created_at": "2026-03-02T12:00:00Z"
}

// Query with isolation filters
{
  "filter": {
    "must": [
      { "key": "agent_id", "match": { "value": "dev-assistant" }},
      { "key": "project_id", "match": { "value": "project-a" }}
    ]
  },
  "with_payload": true,
  "limit": 10
}
```

**Performance optimization:**
Create a payload index with `is_tenant=true` on `agent_id` to co-locate vectors for the same agent. This enables sequential reads and dramatically improves query performance for per-agent searches.

**When to use separate collections:**
Only for < 100 agents needing strict physical isolation, different vector dimensions per agent, or regulatory compliance. Not applicable to Harness's single-user, bounded agent set.

---

## Cross-Framework Comparison Table

| Framework | Memory Scoping Mechanism | Cross-Context Isolation | Semantic Retrieval | Consolidation Pattern |
|-----------|------------------------|------------------------|-------------------|----------------------|
| **Letta/MemGPT** | Per-agent memory blocks | NONE natively (pooled per agent) | YES (archival memory) | Sleep-time agent (deprecated heartbeats) |
| **LangGraph/LangMem** | Hierarchical namespace tuples | YES (by namespace construction) | YES (vector store) | Background async pass |
| **Mem0** | 4-dimension identifier partitioning | YES (strict null isolation) | YES (vector + structured) | Continuous extraction |
| **CrewAI** | Tree-path scope + MemorySlice | YES (scope-based) | YES (LanceDB) | LLM-inferred, post-task |
| **OpenAI Assistants** | Thread-complete isolation | YES (threads are silos) | Via Vector Stores | None (no cross-thread memory) |
| **Amazon AgentCore** | Namespace path hierarchy | YES (namespace-based) | YES (semantic) | 3-step: extract → consolidate → reflect |
| **AutoGen** | Delegated to Mem0/Zep | Depends on integration | Yes (integration) | Depends on integration |
| **Qdrant** (backend) | Payload filter fields | YES (payload filter) | YES (native) | N/A (storage layer) |

---

## Key Research Findings

### Finding 1: Semantic Retrieval Alone Does NOT Solve Context Contamination

**Confidence: HIGH** (multiple authoritative sources)

Every major framework that has addressed this problem has concluded that vector similarity search alone is insufficient for memory scoping. The reason:

> "Context pollution, where irrelevant information degrades reasoning quality, means you need strategies to compress and organize memories." — Redis Engineering Blog

> "A retrieval system might surface a semantically similar memory from a different task context, an outdated state that's since been updated, or content injected through prompt manipulation, and the agent has no way to distinguish authoritative current state from plausibly related historical noise." — O'Reilly: Multi-Agent Memory Engineering

**Why semantic retrieval fails:**
- "User prefers concise answers" from a Discord channel is semantically similar in embedding space to "User prefers detailed technical explanations" from a web coding thread — but they are contextually opposite
- Project-specific preferences ("use tabs in this project") have low semantic differentiation from universal preferences ("user likes tabs") in embedding space
- Domain-crossing memories (dog food in a coding context) may be filtered by relevance score, but only when the query is highly specific. General prompts ("help with this") do not naturally filter irrelevant domains

**The consensus:** Semantic retrieval is a second-pass ranking mechanism, not a first-pass isolation mechanism. Structural scoping (namespace or payload filter) is the first pass; semantic relevance re-ranks within the filtered scope.

### Finding 2: The Industry Standard Is Hierarchical Namespace + Metadata Filtering

**Confidence: HIGH**

All production memory systems (LangGraph, Mem0, AgentCore, Qdrant) use the same architectural pattern:

```
1. STRUCTURAL FILTER first (hard boundary)
   - Must match: agent_id, project_id
   - Returns only memories in the right "bucket"

2. SEMANTIC RANKING second (soft relevance)
   - Vector similarity within the already-filtered pool
   - Re-ranks by relevance to current query

3. RECENCY + IMPORTANCE weighting (final scoring)
   - Harness's existing formula applies here
```

This is "hybrid retrieval" — structured lookups first, semantic search as a second pass.

### Finding 3: Three-Tier Memory Hierarchy Is Industry Consensus

**Confidence: HIGH** (confirmed across Claude.ai, ChatGPT Projects, LangMem, Mem0, AgentCore)

```
Tier 1: GLOBAL / AGENT-WIDE
  - Scope: all threads for this agent, all time
  - Contains: agent personality, user communication preferences, universal working style
  - Examples: "User prefers markdown tables over bullet lists"
  - Retrieval: always considered, lower weight

Tier 2: PROJECT-SCOPED
  - Scope: all threads within a specific project for this agent
  - Contains: project tech stack decisions, coding patterns, domain knowledge
  - Examples: "Project A uses Prisma 6 with PostgreSQL; Project B uses Drizzle with SQLite"
  - Retrieval: only when thread is associated with that project

Tier 3: THREAD / SESSION-SCOPED
  - Scope: single conversation
  - Contains: in-progress work, temporary decisions
  - Examples: "User is currently debugging the auth flow"
  - Retrieval: always injected as conversation history (existing mechanism)
  - Usually NOT persisted to AgentMemory (ephemeral)
```

The prior research file `2026-03-01-ai-projects-memory-hierarchy-research.md` established this three-tier model. This research confirms it is specifically applicable to episodic memory scoping, not just project instructions.

### Finding 4: Episodic Memories Should Be Tagged at Write Time, Not Filtered at Read Time

**Confidence: HIGH** (Mem0, AgentCore, LangMem all follow this pattern)

Every framework stores scope metadata on the memory record itself, written at creation time. None defer scoping to retrieval time.

**At memory write time (after each conversation), the AgentMemory record should include:**
- `agentId` (already exists)
- `projectId` (new — the project associated with the thread that generated this memory)
- `threadId` (new — the specific thread that generated this memory; enables thread-level filtering)
- `channel` (optional — "discord", "web", "cron"; enables channel-level filtering)

This is additive to the current `AgentMemory` model — just additional FK/metadata columns.

### Finding 5: Cross-Channel Continuity Is an Unsolved Problem

**Confidence: MEDIUM** (multiple sources confirm, no authoritative solution found)

The question of "same agent on web vs. Discord — how does context transfer?" has no standard solution in current frameworks.

Current state per framework:
- **Letta**: No native channel concept. All memory is agent-scoped; channels would need to be represented as separate agents or via custom metadata.
- **LangGraph**: Thread isolation means the web thread and Discord thread are separate; long-term memories would need explicit cross-namespace queries.
- **Mem0**: Channel would map to `app_id` (e.g., `app_id="discord"` vs `app_id="web"`). Global memories would have no `app_id` and surface everywhere.
- **No framework**: Implements automatic context bridging between channels (web → Discord handoff is not a solved problem)

**Dominant pattern (where implemented):**
Cross-channel continuity is achieved through **shared global memories with no channel tag** + **channel-specific memories with a channel tag**:
- "User prefers concise answers" (no channel tag) → surfaces on both web and Discord
- "User is in the #home-assistant Discord channel" (channel tag = "discord") → only surfaces on Discord threads

The handoff problem (mid-conversation, switch channels) remains unsolved in frameworks. Most systems treat each channel as a separate conversation context.

### Finding 6: Periodic Memory Consolidation Belongs in a Background Job

**Confidence: HIGH** (LangMem, MemGPT, Amazon AgentCore all document this)

All frameworks agree: memory consolidation (extracting durable facts from conversations, running reflections, merging duplicate memories) should run:
- **After** conversation end, not during (to avoid latency impact)
- **As a background job**, not inline in the pipeline
- **Per context scope**, not globally

Amazon AgentCore's 3-step episodic consolidation pattern:
1. **Extraction**: detect episode completion, extract structured episode record
2. **Consolidation**: merge extractions into a single episode per session
3. **Reflection**: generate cross-episode insights (runs across multiple sessions)

Critically, **reflections must match the episode's namespace pattern but can be less nested**. This means a reflection over `project-a` episodes would be stored at the project level, and a reflection over all project memories would be stored at the agent-global level.

**For Harness's cron-based consolidation:** The existing "Memory Consolidation" cron (1:00 AM daily) is architecturally correct. The consolidation job should be extended to run per-project rather than globally:
- For each project: query its episodic memories, run reflection, write `REFLECTION` type records tagged with `projectId`
- For global agent memories: run a separate reflection pass

---

## Recommended Approach for Harness

### The Core Change: Add Scope Tags to AgentMemory

The minimum viable fix is adding scope metadata to the existing `AgentMemory` model and changing how memories are retrieved.

**Proposed AgentMemory schema additions:**

```prisma
model AgentMemory {
  // ... existing fields (id, agentId, type, content, importance, etc.) ...

  // NEW: scope tags written at memory creation time
  projectId  String?       // FK to Project (if thread was in a project)
  threadId   String?       // FK to Thread that generated this memory
  channel    String?       // "web" | "discord" | "cron" | null (global)

  project    Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  thread     Thread?   @relation(fields: [threadId], references: [id], onDelete: SetNull)
}
```

**Retrieval strategy (replaces the current global pool query):**

When a thread is associated with a project:
```
retrieveMemories(agentId, threadId, query) {
  // Pass 1: Project-scoped memories (highest relevance)
  projectMemories = retrieve({
    agentId,
    projectId: thread.projectId,
    limit: 7,
    query
  })

  // Pass 2: Agent-global memories (no project, no channel)
  globalMemories = retrieve({
    agentId,
    projectId: null,
    channel: null,
    limit: 3,
    query
  })

  return merge_and_dedupe(projectMemories, globalMemories, limit: 10)
}
```

When a thread has no project association:
```
retrieveMemories(agentId, threadId, query) {
  // Only global agent memories (no project-specific contamination)
  return retrieve({
    agentId,
    projectId: null,
    limit: 10,
    query
  })
}
```

### Memory Writing Strategy (What Scope to Assign)

When `score-and-write-memory.ts` creates a new `AgentMemory` record:

```typescript
// Determine scope of the memory being written
const thread = await db.thread.findUnique({
  where: { id: threadId },
  include: { project: true }
});

const memoryScope = {
  projectId: thread.projectId ?? null,
  threadId: threadId,
  channel: detectChannel(thread),  // "discord" | "web" | "cron" | null
};

// Write with scope metadata
await db.agentMemory.create({
  data: {
    agentId,
    type: "EPISODIC",
    content: summary,
    importance,
    ...memoryScope,
  }
});
```

**When to write project-scoped vs. global memories:**
- If the memory contains project-specific facts (tech stack, architecture decisions, project preferences): write with `projectId`
- If the memory contains agent/user-level preferences that apply universally: write with `projectId: null` (global)
- The LLM-based scoring step (Haiku) can be extended to also classify scope: "Is this memory specific to the current project, or is it a universal user preference?"

### Qdrant Integration (Phase 3 Vector Search)

When Qdrant vector search is implemented, the payload structure should include scope tags:

```typescript
// Vector point payload
{
  agent_id: "dev-assistant",
  project_id: "project-a" | null,    // null = global
  thread_id: "thread-xyz",
  channel: "web" | "discord" | null,
  memory_type: "EPISODIC" | "REFLECTION",
  importance: 8,
  created_at: "2026-03-02T12:00:00Z",
}

// Payload indexes (create at collection setup)
// index agent_id with is_tenant=true  ← critical for performance
// index project_id (keyword)
// index channel (keyword)
```

Query pattern:
```typescript
// Project-scoped semantic search
const results = await qdrant.search("agent_memories", {
  vector: embedQuery(currentPrompt),
  filter: {
    must: [
      { key: "agent_id", match: { value: agentId }},
      { key: "project_id", match: { value: projectId }},  // null = only global
    ]
  },
  limit: 7
});
```

### Memory Consolidation / Reflection Scope

**For Phase 4 (Reflection Cycle), when implemented:**
- Run reflection at the project level: "What patterns have I learned from all Project A conversations?"
- Store reflection with `projectId` tag → only surfaces in Project A threads
- Run a separate global reflection pass for agent-universal patterns
- Do NOT run a single global reflection that mixes all projects

This aligns with AgentCore's reflection namespace pattern: reflections can be at any level less nested than the episodes they synthesize.

---

## Architecture Decision: Which Scoping Model?

Three viable models for Harness, ordered by implementation complexity:

### Model A: Tag-Based Isolation (Recommended for Phase 3)

**Mechanism:** Add `projectId`, `threadId`, `channel` fields to `AgentMemory`. Filter at retrieval time.

**Pros:**
- Minimal schema change (additive columns, nullable FKs)
- Works with existing Prisma queries before Qdrant exists
- Memories can be reassigned if thread moves to a different project
- Enables partial queries (project memories OR global memories)
- Aligns with Mem0, AgentCore patterns

**Cons:**
- Retrieval logic becomes more complex (multi-pass query)
- Requires deciding scope at write time (but Haiku scoring already runs at write time)

**Implementation effort:** LOW — schema migration + changes to `retrieve-memories.ts` and `score-and-write-memory.ts`

### Model B: Separate Memory Collections per Project (CrewAI / LangGraph namespace model)

**Mechanism:** Instead of one `AgentMemory` table, use separate Qdrant collections or namespaces per agent+project combination.

**Pros:**
- Cleaner logical separation
- Qdrant collection-per-agent already aligns with their single-collection-per-model recommendation

**Cons:**
- More complex to query across namespaces (need two queries, merge)
- Harder to migrate existing memories
- Qdrant recommends single collection + payload filters for < 100 tenants anyway

**Implementation effort:** HIGH — requires significant refactoring of the memory layer

### Model C: LLM-Inferred Scope (CrewAI approach)

**Mechanism:** When writing a memory, the Haiku scoring call also classifies scope (project-specific vs. global). Memory is written with the appropriate scope automatically.

**Pros:**
- No user action required to categorize memories
- Naturally evolves scope classification over time

**Cons:**
- Adds another dimension to the Haiku classification prompt (accuracy concern)
- Still requires the same schema changes as Model A
- LLM classification can misclassify (a project preference that looks universal)

**Implementation effort:** MEDIUM — schema changes same as A, plus prompt engineering for Haiku

**Recommendation:** Start with Model A (tag-based, at write time, explicit scope based on thread's project association). Add Model C's LLM classification later to handle the "is this universal or project-specific?" distinction. Model B is not recommended unless Qdrant collection-per-agent is already planned for other reasons.

---

## Open Questions Requiring User Input

1. **~~Should threads without a project association generate project-scoped or global memories?~~**
   - **RESOLVED:** LLM classifies scope at write time. Memories from any thread (project-associated or not) can be classified as GLOBAL, PROJECT, or THREAD by the same Haiku call that scores importance. "User prefers tabs" learned in a casual Discord thread gets classified GLOBAL and surfaces everywhere. "We chose Prisma for this project" gets classified PROJECT. Thread-ephemeral context isn't persisted as memory at all.

2. **~~What is the intended scope of "global" agent memories?~~**
   - **RESOLVED:** Global means "about the user or their universal preferences, regardless of where it was learned." The LLM classification prompt distinguishes: GLOBAL = user preferences, communication style, facts about the user that apply everywhere. PROJECT = decisions, patterns, domain knowledge specific to the current project. THREAD = session-specific (not persisted as AgentMemory — conversation history covers it).

3. **How should memories be handled when a thread is later assigned to a project?**
   - Threads may be created without a project, then later associated with one.
   - Should existing memories from that thread be retroactively re-tagged with the project ID?
   - Or only new memories written after the project association?
   - **Implication:** Retroactive re-tagging is cleaner but requires a migration job.

4. **Should cross-project memory access ever be intentional?**
   - Scenario: User explicitly says "Do the same thing as I told you to do in Project A."
   - If Project B memories are strictly isolated from Project A, the agent won't recall Project A's patterns.
   - **Options:** (a) Never allow cross-project access — user must re-explain; (b) Allow explicit cross-project retrieval via a tool the agent can call; (c) Agent-global memories capture universal patterns that apply across all projects.
   - **Recommendation from research:** Option (c) is the standard — the "global" tier captures transferable knowledge. Project-specific implementation details stay project-scoped.

5. **Should the Discord channel be a first-class scope dimension?**
   - Currently the system has web and Discord as delivery channels.
   - If "User is very chatty on Discord but prefers brief answers on web" is a real pattern, you need channel-scoped memory.
   - If the agent should behave identically regardless of channel, channel scoping adds complexity with no benefit.
   - **User input needed:** Does the same agent need different behavior by channel?

6. **Per-agent heartbeat and per-project consolidation: which cron owns this?**
   - Current cron "Memory Consolidation" runs globally at 1:00 AM.
   - If memories become project-scoped, consolidation should run per-project per agent.
   - **Options:** (a) Extend the existing cron to iterate projects; (b) Use the per-agent heartbeat (Phase 5) for project-specific consolidation.
   - **Implication:** If Phase 5 heartbeat is implemented first, per-agent heartbeat can run per-project consolidation naturally.

---

## Implementation Roadmap (Suggested Sequence)

### Step 1: Schema (Unblocks everything else)
- Add `projectId`, `threadId`, `channel` (nullable) to `AgentMemory`
- Add index on `(agentId, projectId)` for efficient retrieval
- Requires: Project model to exist (already exists per prior research)

### Step 2: Write-time scope tagging
- Modify `score-and-write-memory.ts` to accept and store scope metadata
- Thread already knows its `projectId` at invocation time — pass through to memory write
- Low risk: only affects new memories; existing memories get `projectId: null` (treated as global)

### Step 3: Read-time scoped retrieval
- Modify `retrieve-memories.ts` to do two-pass query: project-scoped (if thread has project) + global (no project)
- Merge and re-rank by existing recency+importance formula
- Tune the split ratio (e.g., 7 project + 3 global vs. 5+5)

### Step 4: Qdrant payload tagging (when Phase 3 lands)
- When syncing memories to Qdrant, include `project_id` and `channel` as indexed payload fields
- Use payload filter on vector queries instead of post-filter

### Step 5: LLM scope classification (DECIDED — core, not optional)
- Extend Haiku scoring prompt to also classify scope: GLOBAL, PROJECT, or THREAD
- GLOBAL = user preferences, communication style, universal facts — surfaces everywhere
- PROJECT = decisions, patterns, domain knowledge for the current project — surfaces only in that project's threads
- THREAD = session-specific ephemeral context — not persisted as AgentMemory (conversation history covers it)
- This runs in the same Haiku call that already scores importance — negligible additional cost
- Memories from ANY thread (project-associated or not) can be classified as GLOBAL
- The `scope` field is written to `AgentMemory` at creation time alongside `projectId`

### Step 6: Per-project reflection (when Phase 4 lands)
- Run `run-reflection.ts` per-project rather than globally
- Write `REFLECTION` type memories with `projectId` tag
- Run a separate global reflection for universal patterns

---

## Sources

- [Letta Blog: Agent Memory](https://www.letta.com/blog/agent-memory)
- [Letta Blog: Memory Blocks](https://www.letta.com/blog/memory-blocks)
- [LangGraph Memory Overview](https://docs.langchain.com/oss/python/langgraph/memory)
- [LangGraph Long-Term Memory Launch](https://blog.langchain.com/launching-long-term-memory-support-in-langgraph/)
- [LangGraph Cross-Thread Persistence](https://langchain-ai.github.io/langgraph/how-tos/cross-thread-persistence-functional/)
- [Mem0 Entity-Scoped Memory](https://docs.mem0.ai/platform/features/entity-scoped-memory)
- [CrewAI Memory Docs](https://docs.crewai.com/en/concepts/memory)
- [OpenAI Assistants API Deep Dive](https://platform.openai.com/docs/assistants/deep-dive)
- [Amazon AgentCore Memory Organization](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-organization.html)
- [Amazon AgentCore Episodic Memory Strategy](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/episodic-memory-strategy.html)
- [AutoGen Memory and RAG](https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/memory.html)
- [Qdrant Multitenancy Guide](https://qdrant.tech/documentation/guides/multitenancy/)
- [Qdrant Agentic Builders Guide](https://qdrant.tech/articles/agentic-builders-guide/)
- [O'Reilly: Why Multi-Agent Systems Need Memory Engineering](https://www.oreilly.com/radar/why-multi-agent-systems-need-memory-engineering/)
- [Serokell: Design Patterns for Long-Term Memory](https://serokell.io/blog/design-patterns-for-long-term-memory-in-llm-powered-architectures)
- [Graphlit: Survey of AI Agent Memory Frameworks](https://www.graphlit.com/blog/survey-of-ai-agent-memory-frameworks)
- [Amazon Bedrock AgentCore Memory Blog](https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-agentcore-memory-building-context-aware-agents/)
- [Redis: AI Agent Memory Stateful Systems](https://redis.io/blog/ai-agent-memory-stateful-systems/)
- Prior research: `AI_RESEARCH/2026-03-01-ai-projects-memory-hierarchy-research.md`
- Prior research: `AI_RESEARCH/2026-03-01-agent-workspace-isolation-patterns.md`
