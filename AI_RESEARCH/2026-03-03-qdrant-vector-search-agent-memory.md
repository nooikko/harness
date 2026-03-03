# Research: Qdrant Vector Search for Agent Memory (Phase 3)
Date: 2026-03-03

## Summary

Qdrant is the explicitly chosen vector backend for Phase 3 of the identity plugin's memory system. This document covers all six research areas: deployment, embedding models, collection design, hybrid search, indexing pipeline, and Node.js integration patterns. All findings are sourced from official Qdrant documentation, Voyage AI documentation, and the Anthropic embeddings guide.

## Prior Research

No prior AI_RESEARCH files on this topic. See `.claude/rules/agent-identity-state.md` for Phase 3 status and background.

---

## Area 1 — Qdrant Deployment

### Docker (Development)

Official minimal `docker run`:

```bash
docker run -p 6333:6333 -p 6334:6334 \
  -v "$(pwd)/qdrant_storage:/qdrant/storage:z" \
  qdrant/qdrant:latest
```

REST API at `localhost:6333`. gRPC at `localhost:6334`.

For the monorepo, the recommended approach is to add Qdrant to the project's Docker Compose setup alongside PostgreSQL. Docker Compose v2.23.1+ supports inline config:

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    restart: always
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - ./qdrant_data:/qdrant/storage
```

Storage requirement: block-level access with POSIX-compatible filesystem. NFS and S3-based mounts are NOT supported by Qdrant.

### Qdrant Cloud vs Self-Hosted (Single User)

**Qdrant Cloud free tier:**
- 1GB free cluster forever, no credit card required
- Single node
- Serves approximately 1 million vectors at 768 dimensions in 1GB
- Includes a browser UI for inspecting collections and points
- Zero ops — no Docker container to manage

**Self-hosted:**
- Free (only your infrastructure costs)
- Full control, no vendor dependency
- Can tune memory/disk trade-offs directly
- Requires Docker or Kubernetes
- No automatic HA or zero-downtime upgrades

**Recommendation for this project:** Self-hosted Docker is appropriate for a single-developer system. Development already uses Docker (testcontainers infrastructure is present). Qdrant Cloud free tier is a valid alternative if you want zero ops overhead — the 1GB limit comfortably covers 10K-100K memories at 1024 dimensions.

### RAM and Disk Requirements

Official formula from Qdrant capacity planning docs:
```
memory_size = number_of_vectors * vector_dimension * 4 bytes * 1.5
```

The 1.5× multiplier covers metadata, HNSW index, and temporary optimization segments.

| Scenario | Vectors | Dimensions | RAM Required |
|----------|---------|-----------|-------------|
| 10K memories, 1024-dim | 10,000 | 1,024 | ~62 MB |
| 100K memories, 1024-dim | 100,000 | 1,024 | ~615 MB |
| 100K memories, 512-dim | 100,000 | 512 | ~307 MB |

For 10K-100K agent memories, **512 MB to 1 GB RAM is sufficient with all vectors in memory**. This fits comfortably in any dev machine or small VPS.

**MMAP (on-disk) mode:** RAM floor drops to ~135 MB for 1M 100-dim vectors, but query latency degrades significantly (0.33 req/s vs 780 req/s at full memory). For agent memory retrieval (non-real-time bulk lookups), MMAP is viable. For low-latency conversational retrieval, keep vectors in memory.

**Disk:** SSDs recommended (50k+ IOPS) if using MMAP storage. For all-in-memory at this scale, any SSD is fine.

---

## Area 2 — Embedding Models

### Does Anthropic Offer Embeddings?

**No.** Anthropic's official documentation explicitly states: "Anthropic does not offer its own embedding model." Their recommended alternative is Voyage AI.

Source: https://platform.claude.com/docs/en/build-with-claude/embeddings

### Voyage AI (Anthropic's Official Recommendation)

Voyage AI is the canonical embedding provider recommended by Anthropic. As of March 2026, the current generation models are:

| Model | Context | Default Dim | Variable Dims | Best For |
|-------|---------|------------|--------------|----------|
| `voyage-3-large` | 32K tokens | 1024 | 256, 512, 1024, 2048 | Best general-purpose quality |
| `voyage-3.5` | 32K tokens | 1024 | 256, 512, 1024, 2048 | Balanced quality/cost |
| `voyage-3.5-lite` | 32K tokens | 1024 | 256, 512, 1024, 2048 | Lowest latency and cost |
| `voyage-code-3` | 32K tokens | 1024 | 256, 512, 1024, 2048 | Code retrieval |

Pricing (2025-2026):
- `voyage-3.5-lite`: $0.02/1M tokens
- `voyage-3.5`: $0.06/1M tokens
- `voyage-3-large`: higher (see voyageai.com/pricing)
- First 200M tokens are free

**For agent memory:** `voyage-3.5-lite` is the practical recommendation. Reasoning:
1. Agent memory summaries are short (1-3 sentences per memory). The quality difference between `lite` and `large` is negligible at this length.
2. 32K context window is more than sufficient for any memory summary.
3. $0.02/1M tokens is negligible at 10K-100K memories.
4. 1024-dim default (configurable down to 512 for storage savings).

**Important:** Voyage models use separate `input_type` values for queries vs. stored documents:
- `input_type: "query"` for the current conversation excerpt being searched against
- `input_type: "document"` for memory summaries being stored

This asymmetric embedding is critical for retrieval quality. Do not omit `input_type`.

Source: https://platform.claude.com/docs/en/build-with-claude/embeddings

### OpenAI text-embedding-3-small vs text-embedding-3-large

| Model | Dimensions | Accuracy (MTEB) | Cost per 1M tokens |
|-------|-----------|-----------------|-------------------|
| `text-embedding-3-small` | 1536 | 75.8% | $0.00002 |
| `text-embedding-3-large` | 3072 | 80.5% | $0.00013 |

Key note: `text-embedding-3-large` can be truncated to 256 dims and still outperform unshortened `ada-002` at 1536 dims (Matryoshka embedding property). However, OpenAI has an 8K context limit vs Voyage's 32K — a meaningful difference for longer memory summaries.

**For this project:** Voyage AI is preferred over OpenAI for embeddings because: (1) Anthropic recommends it, (2) 32K context vs 8K, (3) comparable pricing.

### Cohere Embed v3

Cohere `embed-english-v3.0` at 1024 dims. Strong multilingual support via `embed-multilingual-v3.0`. Context window: 512 tokens (significantly shorter than Voyage or OpenAI). Not recommended for this use case due to the context limit.

### Local/Self-Hosted (Ollama)

Ollama supports embedding models via the `embed` endpoint:

```typescript
const response = await ollama.embed({
  model: 'all-minilm:l12-v2',
  input: 'text to embed',
});
```

Available models: `all-minilm:l12-v2` (384 dims), `paraphrase-multilingual` (768 dims), `nomic-embed-text` (768 dims).

**Trade-offs for local embeddings:**
- No API cost
- Requires Ollama service running (another Docker dependency)
- Dimensions are smaller (384-768 vs 1024), meaning lower-quality semantic matching
- No automatic retry/error handling built in
- For a single-developer hobby/personal project, this is viable

**Recommendation:** Voyage AI is the better default. Fall back to Ollama only if offline operation is required.

### Embedding Dimension Trade-offs

| Dimensions | Storage (100K vectors) | Query Speed | Semantic Quality |
|-----------|----------------------|-------------|-----------------|
| 256 | ~100 MB | Fastest | Adequate for short text |
| 512 | ~200 MB | Fast | Good for memory summaries |
| 1024 | ~400 MB | Moderate | Excellent for all use cases |
| 2048 | ~800 MB | Slower | Marginal improvement over 1024 |

For agent memory (short summaries, 1-3 sentences), **512 or 1024 dimensions** are the sweet spot. 1024 is the Voyage default and covers all cases well without excessive storage overhead.

---

## Area 3 — Collection Design for Scoped Memories

### Single Collection with Payload Filtering (Recommended)

Qdrant's official recommendation for multi-tenant scenarios is **one collection per embedding model with payload-based filtering**. From the multitenancy docs:

> "In most cases, a single collection per embedding model with payload-based partitioning for different tenants."

This approach:
- Has practically no overhead per tenant when tenants are small
- Allows cross-agent queries if ever needed
- Avoids the resource overhead of per-agent collection management

For this system, the collection design would be:

```
Collection: "agent_memories"
  Point payload:
    agentId: string (keyword index, is_tenant=true)
    projectId: string | null (keyword index)
    threadId: string | null (keyword index)
    memoryType: "EPISODIC" | "REFLECTION" | "SEMANTIC" (keyword index)
    importance: float (float index, for range filtering)
    createdAt: datetime (datetime index, for recency scoring)
    lastAccessedAt: datetime (datetime index)
    postgresId: string (the AgentMemory.id from PostgreSQL, for linking)
```

### Qdrant Payload Filtering — AND Logic Across Multiple Fields

Qdrant supports simultaneous `agentId + projectId + vector search` via the `must` array (AND logic):

```typescript
await client.query("agent_memories", {
  query: embeddingVector,  // dense vector similarity
  filter: {
    must: [
      { key: "agentId", match: { value: agentId } },
      { key: "projectId", match: { value: projectId } },
    ],
  },
  limit: 20,
});
```

This is done in a single request — not two separate queries. The filterable HNSW index ensures this is efficient.

### Tenant Optimization (is_tenant Flag)

When creating the payload index for `agentId`, set `is_tenant: true`. This instructs Qdrant to co-locate vectors of the same agent physically, improving sequential read performance during filtered queries:

```typescript
await client.createPayloadIndex("agent_memories", {
  field_name: "agentId",
  field_schema: {
    type: "keyword",
    is_tenant: true,
  },
});
```

For the `m: 0` / `payload_m: 16` HNSW optimization (from multitenancy docs) — only use this if the global (cross-agent) index is never needed. Since this project queries per-agent always, it's applicable.

### Named Vectors — Multiple Representations Per Point

Qdrant supports named vectors (since v0.10), allowing a single point to have multiple vector representations with different dimensions or distance metrics:

```typescript
await client.createCollection("agent_memories", {
  vectors: {
    "content": { size: 1024, distance: "Cosine" },
    "title": { size: 512, distance: "Cosine" },
  },
});
```

**For this use case:** Named vectors are not needed initially. One `content` vector per memory (1024-dim) is sufficient. Named vectors become relevant if you later want to search by both summary content and metadata separately.

### Filtering Performance

Qdrant uses Filterable HNSW — it adds extra graph edges based on payload indexes, so filtered vector search stays efficient rather than degrading to brute-force scan. Performance is near-identical to unfiltered search when payload indexes exist on the filtered fields.

Source: https://qdrant.tech/documentation/guides/multitenancy/

---

## Area 4 — Hybrid Search and Re-ranking

### Qdrant's Query API (Hybrid Search)

Qdrant's hybrid search combines dense vectors (semantic) with sparse vectors (keyword) via the `prefetch` + `query: { fusion: "rrf" }` pattern:

```typescript
await client.query("agent_memories", {
  prefetch: [
    {
      query: denseEmbeddingVector,
      using: "dense",
      limit: 30,
    },
    {
      query: { values: sparseValues, indices: sparseIndices },
      using: "sparse",
      limit: 30,
    },
  ],
  query: { fusion: "rrf" },  // Reciprocal Rank Fusion
  filter: { must: [{ key: "agentId", match: { value: agentId } }] },
  limit: 10,
});
```

Fusion methods:
- **RRF (Reciprocal Rank Fusion):** Boosts items appearing near the top of multiple result sets. Available since initial hybrid search support.
- **DBSF (Distribution-Based Score Fusion):** Normalizes scores before combining. Available since v1.11.0.
- **Weighted RRF:** Assign weights to each prefetch query to prioritize one retrieval method. Available since v1.17.0.

**Sparse vectors require a separate index setup** (SPLADE or BM25-style). For agent memory (short summaries), pure dense vector search is likely sufficient initially. Hybrid search adds complexity; skip for Phase 3 and add later if retrieval quality requires it.

### Combining Qdrant Results with Existing Recency + Importance Scoring

The existing `retrieve-memories.ts` scores by:
```
score = DECAY_RATE^hoursSince + (importance / 10) + typeBoost
```

For Phase 3, the integration plan is:

**Option A — Post-query re-scoring (simplest):**
Use Qdrant for candidate retrieval (top 30-50 by vector similarity, filtered to the agent/project), then apply the existing recency+importance scoring formula in memory before returning the top N. This keeps the existing scoring logic intact and adds semantic filtering as a pre-stage.

**Option B — Qdrant's built-in score boosting (cleanest):**
Qdrant v1.14+ supports decay function re-scoring at query time. Example using exponential decay on `createdAt` combined with vector score:

```typescript
await client.query("agent_memories", {
  query: embeddingVector,
  filter: { must: [{ key: "agentId", match: { value: agentId } }] },
  // Formula scoring: combine vector similarity with recency decay
  // Note: this requires Qdrant's formula scoring API (v1.14+)
  limit: 10,
});
```

The decay function API uses `sum[$score, decay_exp(...)]` syntax to blend semantic score with recency. However, as of the research date, the TypeScript client's support for formula scoring is newer; verify against `@qdrant/js-client-rest` v1.17.0 types.

**Recommendation:** Start with Option A (post-query re-scoring) for Phase 3. It's a minimal code change to `retrieve-memories.ts` — replace the PostgreSQL `findMany` candidate fetch with a Qdrant query, then apply the same scoring formula. Option B can be applied as an optimization pass after the basic integration works.

Source: https://qdrant.tech/blog/decay-functions/

---

## Area 5 — Indexing Pipeline

### When to Embed

**Embed at write time (recommended for this system).** The current `score-and-write-memory.ts` already runs asynchronously (fire-and-forget) after each invocation. The embedding step fits naturally after the summary is generated:

```
1. Haiku scores importance (existing)
2. If importance >= 6: Haiku generates summary (existing)
3. Voyage AI embeds the summary (NEW) — async, fire-and-forget
4. db.agentMemory.create (existing PostgreSQL write)
5. Qdrant upsert (NEW) — write the embedding + payload to Qdrant
```

This keeps the pipeline non-blocking and co-locates the embed with the write.

### Handling Memory Updates (Re-embed on Change?)

AgentMemory records are not currently updated after creation (only `lastAccessedAt` changes). Re-embedding is only needed if the `content` field changes. Given the current design, this is not a concern.

If `content` ever changes, the pattern is: delete the old Qdrant point (by ID) and upsert a new one with the new embedding. Use the PostgreSQL `AgentMemory.id` as the Qdrant point ID for easy cross-referencing.

### ID Strategy

Use the PostgreSQL `AgentMemory.id` (a CUID string) as the Qdrant point ID. Qdrant supports string UUIDs as point IDs. This makes the two stores consistent without a separate ID mapping:

```typescript
await client.upsert("agent_memories", {
  wait: true,
  points: [{
    id: agentMemory.id,  // PostgreSQL CUID
    vector: embedding,
    payload: {
      agentId: agentMemory.agentId,
      projectId: agentMemory.projectId ?? null,
      threadId: agentMemory.threadId ?? null,
      memoryType: agentMemory.type,
      importance: agentMemory.importance,
      createdAt: agentMemory.createdAt.getTime() / 1000,  // Unix seconds for decay functions
      postgresId: agentMemory.id,
    },
  }],
});
```

### Embedding Caching

For a single-developer system with 10K-100K memories and write-once semantics, no embedding cache is needed. Each memory is embedded exactly once at write time. The cost at Voyage pricing ($0.02/1M tokens) is negligible.

If you migrate existing memories in bulk, use Voyage's batch API (up to 1,000 texts per request) to minimize API calls.

### Batch Migration of Existing Memories

For migrating existing `AgentMemory` records from PostgreSQL to Qdrant:

```typescript
// Fetch all memories in chunks
const PAGE_SIZE = 500;
let cursor: string | undefined;

while (true) {
  const memories = await prisma.agentMemory.findMany({
    take: PAGE_SIZE,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { id: "asc" },
  });

  if (memories.length === 0) break;

  // Batch embed with Voyage (up to 1000 per request)
  const embedResult = await voyageClient.embed({
    input: memories.map((m) => m.content),
    model: "voyage-3.5-lite",
    inputType: "document",
  });

  // Batch upsert to Qdrant
  await qdrantClient.upsert("agent_memories", {
    wait: true,
    points: memories.map((m, i) => ({
      id: m.id,
      vector: embedResult.embeddings[i],
      payload: { agentId: m.agentId, importance: m.importance, ... },
    })),
  });

  cursor = memories[memories.length - 1]?.id;
}
```

---

## Area 6 — Node.js / TypeScript Integration Patterns

### Package Versions (as of 2026-03-03)

```
@qdrant/js-client-rest   1.17.0   (npm latest)
voyageai                 0.2.1    (npm latest)
@testcontainers/qdrant   11.12.0  (npm latest)
```

### Client Initialization

`@qdrant/js-client-rest` uses the native `fetch` API (Node.js 18+ without experimental flag). The client is stateless — no connection pooling needed. Instantiate once as a module-level singleton:

```typescript
// packages/plugins/identity/src/_helpers/qdrant-client.ts
import { QdrantClient } from "@qdrant/js-client-rest";

type GetQdrantClient = () => QdrantClient;

export const getQdrantClient: GetQdrantClient = () =>
  new QdrantClient({ url: process.env.QDRANT_URL ?? "http://localhost:6333" });
```

One export per file, named to match the filename — follows the project's established pattern.

For Qdrant Cloud (with API key):
```typescript
new QdrantClient({
  url: "https://your-cluster.aws.cloud.qdrant.io",
  apiKey: process.env.QDRANT_API_KEY,
});
```

### Voyage AI Client Initialization

```typescript
// packages/plugins/identity/src/_helpers/voyage-client.ts
import { VoyageAIClient } from "voyageai";

type GetVoyageClient = () => VoyageAIClient;

export const getVoyageClient: GetVoyageClient = () =>
  new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY ?? "" });
```

The `voyageai` SDK includes automatic retry (2 attempts by default) on 408, 429, 5XX errors. Default timeout is 60 seconds.

### Embedding a Memory Summary

```typescript
// packages/plugins/identity/src/_helpers/embed-memory.ts
import type { VoyageAIClient } from "voyageai";

type EmbedMemory = (client: VoyageAIClient, text: string) => Promise<number[]>;

export const embedMemory: EmbedMemory = async (client, text) => {
  const result = await client.embed({
    input: [text],
    model: "voyage-3.5-lite",
    inputType: "document",
  });
  return result.embeddings[0] ?? [];
};
```

### Embedding a Query (Different input_type)

```typescript
// packages/plugins/identity/src/_helpers/embed-query.ts
import type { VoyageAIClient } from "voyageai";

type EmbedQuery = (client: VoyageAIClient, query: string) => Promise<number[]>;

export const embedQuery: EmbedQuery = async (client, query) => {
  const result = await client.embed({
    input: [query],
    model: "voyage-3.5-lite",
    inputType: "query",
  });
  return result.embeddings[0] ?? [];
};
```

### Error Handling Pattern

When Qdrant is down, memory retrieval should degrade gracefully, not crash the pipeline. The existing `score-and-write-memory.ts` pattern (fire-and-forget with silent error swallowing) is the right model:

```typescript
// In retrieve-memories.ts Phase 3 enhancement
const getVectorCandidates = async (
  qdrant: QdrantClient,
  agentId: string,
  queryVector: number[],
  limit: number,
): Promise<string[]> => {
  try {
    const results = await qdrant.query("agent_memories", {
      query: queryVector,
      filter: { must: [{ key: "agentId", match: { value: agentId } }] },
      limit,
      with_payload: false,
    });
    return results.points.map((p) => String(p.id));
  } catch (err) {
    // Qdrant unavailable — fall back to pure PostgreSQL retrieval
    return [];
  }
};
```

When `getVectorCandidates` returns an empty array (Qdrant down), `retrieveMemories` falls back to the current recency+importance scoring from PostgreSQL alone.

### When Voyage AI is Down

The `embedQuery` call happens in `onBeforeInvoke` (before Claude is called). If it throws:
- Option A: Catch and return `null`, skip vector search, fall back to PostgreSQL-only retrieval.
- Option B: Let it propagate and use the existing error isolation in `run-chain-hook.ts` (which keeps the previous prompt value on error).

Option A is preferred — it's an explicit degradation strategy.

### Testing — Unit Tests (Vitest)

Mock Qdrant and Voyage clients with `vi.mock`:

```typescript
// packages/plugins/identity/src/_helpers/__tests__/embed-memory.test.ts
import { describe, it, expect, vi } from "vitest";
import type { VoyageAIClient } from "voyageai";

const mockClient = {
  embed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }),
} as unknown as VoyageAIClient;

describe("embedMemory", () => {
  it("returns the first embedding vector", async () => {
    const { embedMemory } = await import("../embed-memory");
    const result = await embedMemory(mockClient, "test memory content");
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockClient.embed).toHaveBeenCalledWith({
      input: ["test memory content"],
      model: "voyage-3.5-lite",
      inputType: "document",
    });
  });
});
```

### Testing — Integration Tests (Testcontainers)

The project already uses testcontainers for PostgreSQL. Qdrant has an official Node.js testcontainers module:

```typescript
// packages/plugins/identity/src/_helpers/__tests__/qdrant-integration.test.ts
import { QdrantContainer } from "@testcontainers/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";

describe("Qdrant integration", () => {
  let container: Awaited<ReturnType<typeof new QdrantContainer("qdrant/qdrant:latest").start>>;
  let client: QdrantClient;

  beforeAll(async () => {
    container = await new QdrantContainer("qdrant/qdrant:latest").start();
    client = new QdrantClient({ url: `http://${container.getRestHostAddress()}` });
  }, 60_000);

  afterAll(async () => {
    await container.stop();
  });

  it("creates collection and upserts a point", async () => {
    await client.createCollection("test", {
      vectors: { size: 4, distance: "Cosine" },
    });
    await client.upsert("test", {
      wait: true,
      points: [{ id: "abc-123", vector: [0.1, 0.2, 0.3, 0.4], payload: { agentId: "a1" } }],
    });
    const results = await client.query("test", {
      query: [0.1, 0.2, 0.3, 0.4],
      limit: 1,
    });
    expect(results.points[0]?.id).toBe("abc-123");
  });
});
```

The `@testcontainers/qdrant` package matches the existing pattern used for PostgreSQL integration tests in this project.

Source: https://node.testcontainers.org/modules/qdrant/

---

## Key Takeaways

### Implementation Order for Phase 3

1. **Add dependencies** to `packages/plugins/identity/package.json`:
   - `@qdrant/js-client-rest@^1.17.0`
   - `voyageai@^0.2.1`
   - Dev: `@testcontainers/qdrant@^11.12.0`

2. **Add env vars**: `QDRANT_URL`, `VOYAGE_API_KEY`

3. **Add Qdrant to Docker Compose** (development)

4. **Collection setup** — create `agent_memories` collection on plugin `start()`:
   - Size: 1024, Distance: Cosine
   - Payload indexes: `agentId` (keyword, `is_tenant: true`), `projectId` (keyword), `memoryType` (keyword), `importance` (float), `createdAt` (datetime)

5. **Embed at write time** — in `score-and-write-memory.ts`, after the summary is generated and before `db.agentMemory.create`, embed with Voyage and upsert to Qdrant

6. **Semantic retrieval** — in `retrieve-memories.ts`, add Qdrant query as candidate pre-filter. Query the current conversation excerpt as `input_type: "query"`. Use agentId + optional projectId filter. Get top 50 semantic matches, then apply existing recency+importance scoring on the PostgreSQL records for those IDs.

7. **Graceful degradation** — if Qdrant or Voyage are unavailable, fall back to existing PostgreSQL-only scoring

8. **Migration script** — batch-embed existing AgentMemory records into Qdrant

### Single Collection Design (Definitive)

Use one collection: `agent_memories`. Filter by `agentId` on every query. Optionally further filter by `projectId` for project-scoped retrieval. This is the Qdrant-recommended pattern for this scale and use case.

### Embedding Model Choice

`voyage-3.5-lite` at 1024 dimensions. Reasons:
- Anthropic's recommended provider
- 32K context window (vs OpenAI's 8K)
- $0.02/1M tokens (200M tokens free)
- 1024 dims is the default, no truncation needed
- Supports separate `input_type` for query vs. document (critical for retrieval quality)

### Qdrant Deployment Choice

Self-hosted Docker for development. Either self-hosted or Qdrant Cloud free tier (1GB, ~1M vectors) for production. For 10K-100K memories, the free tier is sufficient indefinitely.

---

## Gaps Identified

- **Qdrant formula scoring TypeScript API:** The decay function / formula scoring API (v1.14+) is documented but the exact TypeScript client interface for it was not confirmed from official typed examples. Verify `@qdrant/js-client-rest` v1.17.0 supports it before implementing Option B re-ranking.
- **Voyage API rate limits:** Not researched. For a single-user system writing one memory per message, rate limits are unlikely to be a concern.
- **SPLADE sparse vectors for hybrid search:** Not applicable for Phase 3. Dense-only search is the starting point.
- **Qdrant version to pin:** Tested with `qdrant/qdrant:latest`. For production, pin to a specific version tag (e.g., `qdrant/qdrant:v1.14.x`) to avoid unexpected breaking changes.

---

## Sources

- [Anthropic embeddings documentation](https://platform.claude.com/docs/en/build-with-claude/embeddings)
- [Qdrant Quickstart](https://qdrant.tech/documentation/quickstart/)
- [Qdrant Installation guide](https://qdrant.tech/documentation/guides/installation/)
- [Qdrant Capacity Planning](https://qdrant.tech/documentation/guides/capacity-planning/)
- [Qdrant Memory Consumption article](https://qdrant.tech/articles/memory-consumption/)
- [Qdrant Filtering documentation](https://qdrant.tech/documentation/concepts/filtering/)
- [Qdrant Indexing documentation](https://qdrant.tech/documentation/concepts/indexing/)
- [Qdrant Multitenancy guide](https://qdrant.tech/documentation/guides/multitenancy/)
- [Qdrant Hybrid Queries](https://qdrant.tech/documentation/concepts/hybrid-queries/)
- [Qdrant Decay Functions blog post](https://qdrant.tech/blog/decay-functions/)
- [Qdrant Agentic Builders Guide](https://qdrant.tech/articles/agentic-builders-guide/)
- [Qdrant Reranking for Better Search](https://qdrant.tech/documentation/search-precision/reranking-semantic-search/)
- [Qdrant JavaScript SDK (GitHub)](https://github.com/qdrant/qdrant-js)
- [@qdrant/js-client-rest on npm](https://www.npmjs.com/package/@qdrant/js-client-rest)
- [Voyage AI embeddings documentation](https://docs.voyageai.com/docs/embeddings)
- [Voyage AI TypeScript SDK (GitHub)](https://github.com/voyage-ai/typescript-sdk)
- [voyageai on npm](https://www.npmjs.com/package/voyageai)
- [Qdrant Testcontainers for Node.js](https://node.testcontainers.org/modules/qdrant/)
- [@testcontainers/qdrant on npm](https://www.npmjs.com/package/@testcontainers/qdrant)
- [OpenAI embedding comparison (Arsturn)](https://www.arsturn.com/blog/comparing-openai-text-embedding-3-small-large)
