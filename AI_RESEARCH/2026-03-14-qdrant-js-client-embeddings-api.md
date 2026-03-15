# Research: Qdrant JS Client REST API + Node.js Embeddings

Date: 2026-03-14

## Summary

Complete API reference for `@qdrant/js-client-rest` (constructor, createCollection, upsert, search, delete) plus evaluation of zero-config embedding options for Node.js. Recommendation: `@huggingface/transformers` with `Xenova/all-MiniLM-L6-v2` (384-dim, no external service, downloads model on first run).

## Prior Research

- `2026-03-03-qdrant-vector-search-agent-memory.md` — covers Qdrant architecture and use cases at a higher level
- `2026-03-03-embedding-model-competitive-landscape.md` — general landscape

## Current Findings

---

### 1. `@qdrant/js-client-rest` — Constructor

**Installation:**
```bash
npm install @qdrant/js-client-rest
```

**QdrantClientParams interface** (all fields optional):
```typescript
type QdrantClientParams = {
  url?: string;          // Full URL including protocol, e.g. "http://localhost:6333"
  host?: string;         // Hostname only, no protocol or port (mutually exclusive with url)
  port?: number | null;  // Default: 6333
  https?: boolean;       // Enable TLS
  prefix?: string;       // URL path prefix
  apiKey?: string;       // Enables HTTPS automatically when set
  timeout?: number;      // Milliseconds, default 300000 (5 min)
  headers?: Record<string, number | string | string[] | undefined>;
  maxConnections?: number;
  checkCompatibility?: boolean; // Default: true
};
```

**Important constraint:** `url` and `host` are mutually exclusive. The constructor throws if both are provided. `host` must not include protocol or port.

**Constructor examples:**
```typescript
import { QdrantClient } from "@qdrant/js-client-rest";

// Using host + port (local dev)
const client = new QdrantClient({ host: "localhost", port: 6333 });

// Using full URL
const client = new QdrantClient({ url: "http://localhost:6333" });

// Cloud / authenticated
const client = new QdrantClient({
  url: "https://xyz.us-east-1-0.aws.cloud.qdrant.io",
  apiKey: "your-api-key",
});
```

---

### 2. createCollection

```typescript
// Cosine similarity (recommended for normalized text embeddings)
await client.createCollection("my_collection", {
  vectors: { size: 384, distance: "Cosine" },
});

// Dot product
await client.createCollection("my_collection", {
  vectors: { size: 384, distance: "Dot" },
});

// Euclidean distance
await client.createCollection("my_collection", {
  vectors: { size: 384, distance: "Euclid" },
});

// Check existence before creating
const exists = await client.collectionExists("my_collection");
if (!exists.result?.exists) {
  await client.createCollection("my_collection", {
    vectors: { size: 384, distance: "Cosine" },
  });
}

// Delete a collection
await client.deleteCollection("my_collection");
```

**Distance metric guidance:**
- Use `"Cosine"` for sentence/text embeddings (most common)
- Use `"Dot"` when vectors are pre-normalized and you want maximum speed
- Qdrant docs note: "Cosine similarity is implemented as dot-product over normalized vectors. Vectors are automatically normalized during upload."

---

### 3. Upsert Points

```typescript
await client.upsert("my_collection", {
  wait: true,       // Wait for operation to complete before returning
  points: [
    {
      id: 1,        // numeric or UUID string
      vector: [0.05, 0.61, 0.76, 0.74],  // must match collection vector size
      payload: { text: "Hello world", source: "doc1.txt" },
    },
    {
      id: 2,
      vector: [0.19, 0.81, 0.75, 0.11],
      payload: { text: "Another document", source: "doc2.txt" },
    },
  ],
});
```

**Notes:**
- `wait: true` ensures the operation is fully indexed before returning. Use `false` for fire-and-forget batch imports.
- `id` can be a non-negative integer or a UUID string.
- `payload` is a free-form JSON object — any serializable values.
- Upserting an existing ID overwrites the point (no separate update method needed).

---

### 4. Search / Query by Vector Similarity

**Basic search:**
```typescript
const result = await client.query("my_collection", {
  query: [0.2, 0.1, 0.9, 0.7],  // query vector, same dimension as collection
  limit: 10,
});

// Points are at result.points
for (const point of result.points) {
  console.log(point.id, point.score, point.payload);
}
```

**Search with filter:**
```typescript
const result = await client.query("my_collection", {
  query: [0.2, 0.1, 0.9, 0.7],
  filter: {
    must: [
      { key: "source", match: { value: "doc1.txt" } },
    ],
  },
  with_payload: true,
  limit: 5,
});
```

**Filter operators available:**
- `must` — all conditions required (AND)
- `should` — at least one required (OR)
- `must_not` — exclude matching (NOT)
- `match: { value }` — exact match
- `range` — numeric range comparisons

**Return shape:**
```typescript
// result.points: Array<{
//   id: number | string;
//   version: number;
//   score: number;       // similarity score (higher = more similar for Cosine/Dot)
//   payload?: Record<string, unknown>;
//   vector?: number[];   // only if with_vectors: true
// }>
```

---

### 5. Delete Points

**Delete by IDs:**
```typescript
await client.delete("my_collection", {
  points: [1, 2, 100],   // array of point IDs
});
```

**Delete by filter:**
```typescript
await client.delete("my_collection", {
  filter: {
    must: [
      { key: "source", match: { value: "old-file.txt" } },
    ],
  },
});
```

Both forms accept the same filter syntax as search queries.

---

### 6. Embeddings: Option Comparison

| Option | External service | First-run download | Dim | Node.js support | Notes |
|--------|-----------------|-------------------|-----|-----------------|-------|
| `@huggingface/transformers` + `Xenova/all-MiniLM-L6-v2` | None | ~25 MB ONNX model | 384 | Yes (v18+) | RECOMMENDED |
| `@huggingface/transformers` + `Xenova/nomic-embed-text-v1` | None | ~280 MB ONNX model | 768 | Yes (v18+) | Requires task prefix |
| Ollama + `nomic-embed-text` | Yes (localhost) | Model pull required | 768 | Via HTTP only | Requires running service |
| OpenAI `text-embedding-3-small` | Yes (API) | None | 1536 | Via HTTP | Costs money, needs API key |

**Recommendation: `@huggingface/transformers` with `Xenova/all-MiniLM-L6-v2`**

Reasons:
- Zero external services (Qdrant only)
- Model downloads and caches automatically on first run
- 384 dimensions is sufficient for semantic memory search
- Widely used, well-tested in Node.js environments
- `@xenova/transformers` is the old package name — `@huggingface/transformers` is the current name (v3+)

---

### 7. Embedding Code Examples

**Installation:**
```bash
npm install @huggingface/transformers
```

**Single text embedding:**
```typescript
import { pipeline } from "@huggingface/transformers";

// Load once, reuse across calls (expensive to load)
const extractor = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2"
);

// Single string -> one embedding
const output = await extractor("This is my text", {
  pooling: "mean",
  normalize: true,
});

// Convert tensor to flat number[]
const embedding: number[] = output.tolist()[0];
// embedding.length === 384
```

**Batch embeddings:**
```typescript
const texts = ["First document", "Second document", "Third document"];
const output = await extractor(texts, { pooling: "mean", normalize: true });
const embeddings: number[][] = output.tolist();
// embeddings[0] => float[] of length 384
// embeddings[1] => float[] of length 384
// etc.
```

**Singleton pattern for production (avoids reloading model on every call):**
```typescript
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

let _extractor: FeatureExtractionPipeline | null = null;

const getExtractor = async (): Promise<FeatureExtractionPipeline> => {
  if (!_extractor) {
    _extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return _extractor;
};

const embed = async (text: string): Promise<number[]> => {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return output.tolist()[0];
};
```

**nomic-embed-text-v1 (768-dim, requires task prefixes):**
```typescript
// IMPORTANT: nomic-embed-text requires task instruction prefixes
const output = await extractor("search_query: What is TSNE?", {
  pooling: "mean",
  normalize: true,
});
// Prefix options: search_query:, search_document:, clustering:, classification:
// Dimension: 768
```

---

### 8. Full End-to-End Example (all-MiniLM-L6-v2 + Qdrant)

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";
import { pipeline } from "@huggingface/transformers";

const COLLECTION = "agent_memories";
const VECTOR_SIZE = 384;  // all-MiniLM-L6-v2 output size

const client = new QdrantClient({ host: "localhost", port: 6333 });
const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

const embed = async (text: string): Promise<number[]> => {
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return output.tolist()[0];
};

// 1. Create collection (idempotent pattern)
const exists = await client.collectionExists(COLLECTION);
if (!exists.result?.exists) {
  await client.createCollection(COLLECTION, {
    vectors: { size: VECTOR_SIZE, distance: "Cosine" },
  });
}

// 2. Upsert
const vector = await embed("The agent observed a sunny day in Berlin");
await client.upsert(COLLECTION, {
  wait: true,
  points: [
    {
      id: 1,
      vector,
      payload: { agentId: "agent-1", text: "sunny day in Berlin", importance: 7 },
    },
  ],
});

// 3. Search
const queryVector = await embed("weather observations");
const results = await client.query(COLLECTION, {
  query: queryVector,
  filter: {
    must: [{ key: "agentId", match: { value: "agent-1" } }],
  },
  with_payload: true,
  limit: 5,
});
console.log(results.points);

// 4. Delete by ID
await client.delete(COLLECTION, { points: [1] });

// 5. Delete by filter
await client.delete(COLLECTION, {
  filter: {
    must: [{ key: "agentId", match: { value: "agent-1" } }],
  },
});
```

---

## Key Takeaways

1. **Package name changed**: Use `@huggingface/transformers` (v3+), not `@xenova/transformers` (legacy v2). The HuggingFace model card examples still show `@xenova/transformers` for some models but the new package works identically.

2. **`url` vs `host`**: These are mutually exclusive in QdrantClient. Never pass both. Use `url` for full connection strings (cloud), `host`+`port` for local.

3. **`wait: true` on upsert**: Always set this in synchronous code paths. Without it, the point may not be searchable immediately after return.

4. **`output.tolist()`**: The `pipeline` returns a `Tensor` object, not a raw array. Call `.tolist()` to get `number[][]`, then take `[0]` for a single text input.

5. **Model caching**: On first run, `@huggingface/transformers` downloads ONNX weights to `./node_modules/@huggingface/transformers/.cache/`. Set `env.cacheDir = "./.cache"` to control location.

6. **all-MiniLM-L6-v2 vs nomic-embed-text**:
   - `all-MiniLM-L6-v2`: 384-dim, ~25 MB, no prefix required, fast. Best for most use cases.
   - `nomic-embed-text-v1`: 768-dim, ~280 MB, requires task prefixes (`search_query:`, etc.), better retrieval quality.

7. **`client.query()` is the modern search API**: Earlier Qdrant client versions used `client.search()`. The current API uses `client.query()` — results at `result.points`, not `result`.

## Sources

- Qdrant Quickstart: https://qdrant.tech/documentation/quickstart/
- Qdrant Points API: https://qdrant.tech/documentation/concepts/points/
- Qdrant Collections API: https://qdrant.tech/documentation/concepts/collections/
- QdrantClient source (QdrantClientParams): https://raw.githubusercontent.com/qdrant/qdrant-js/master/packages/js-client-rest/src/qdrant-client.ts
- Transformers.js Node.js tutorial: https://huggingface.co/docs/transformers.js/en/tutorials/node
- Transformers.js pipelines API: https://huggingface.co/docs/transformers.js/en/api/pipelines
- Xenova/all-MiniLM-L6-v2 model card: https://huggingface.co/Xenova/all-MiniLM-L6-v2
- Xenova/nomic-embed-text-v1 model card: https://huggingface.co/Xenova/nomic-embed-text-v1
- nomic-ai/nomic-embed-text-v1.5 (dimension specs): https://huggingface.co/nomic-ai/nomic-embed-text-v1.5
