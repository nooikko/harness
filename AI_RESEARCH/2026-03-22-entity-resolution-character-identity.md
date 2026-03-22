# Research: Entity Resolution and Record Linkage for Narrative Character Identity
Date: 2026-03-22

## Summary

Research into entity resolution (ER) and record linkage techniques applicable to a storytelling system where:
- The same person is extracted under multiple names/descriptions across transcripts
- Initial extractions sometimes produce "trash" records (e.g., a note as a character name)
- Once a bad record is created it is locked in — no retroactive correction

This document covers: available libraries, knowledge graph approaches to evolving identity, incremental ER state-of-the-art, embedding-based clustering, and LLM-as-judge for pairwise character matching.

## Prior Research

None in AI_RESEARCH/ — this is a new topic.

## Current Findings

---

### Sub-question 1: Entity Resolution / Record Linkage Libraries

#### Python (primary ecosystem — can call via subprocess from Node.js)

**Splink** — https://moj-analytical-services.github.io/splink/
- UK Ministry of Justice open source project, the most actively maintained ER library
- Probabilistic record linkage using Fellegi-Sunter / Expectation-Maximisation
- Backends: DuckDB (default, runs locally), PySpark, AWS Athena, PostgreSQL, SQLite
- Can link 1M records in ~1 minute on a laptop
- Supports fuzzy matching, term frequency adjustments, user-defined comparison functions
- Does NOT have native incremental/streaming support — runs as a batch over the full dataset
- Golden record: not built-in, requires post-processing clusters
- Confidence: HIGH (official docs at moj-analytical-services.github.io/splink)

**dedupe** — https://github.com/dedupeio/dedupe / https://docs.dedupe.io/
- Active learning approach: asks a human (or simulated labeler) to label record pairs as match/non-match
- Learns a probabilistic model from labeled pairs; useful when you have examples of correct merges
- Incremental workflow: `StaticDedupe.partition()` re-clusters the FULL dataset from scratch (no true streaming)
- Gazetteer mode: matches new messy records against a stable canonical set; supports `index()` / `search()` without reprocessing the canonical side — this is the closest thing to streaming in the library
- Cluster IDs are regenerated on each full run; no stable cluster identity across runs
- Confidence: HIGH (official docs)

**GoldenMatch** — https://github.com/benzsevern/goldenmatch
- Newer toolkit (2024/2025); Python-only, pip installable
- 10+ scoring methods: exact, Jaro-Winkler, Levenshtein, token sort, phonetic (soundex), embeddings, ensemble
- 8+ blocking strategies including FAISS approximate nearest neighbor (ANN)
- Probabilistic matching with EM-trained m/u probabilities
- Five golden record merge strategies: `most_complete`, `majority_vote`, `source_priority`, `most_recent`, `first_non_null`
- Optional LLM scorer using GPT-4o-mini or Claude for borderline pairs (~$0.04-$0.74 per dataset)
- Benchmarks: 97% F1 on structured data; 7,800 records/second
- This is the most directly applicable library — it combines embedding similarity, probabilistic matching, LLM fallback, and golden record selection in one package
- Confidence: MEDIUM (GitHub README, no independent benchmarks found)

**PyJedAI** — https://github.com/AI-team-UoA/pyJedAI
- Python and Java; state-of-the-art clustering algorithms for ER
- Includes progressive ER algorithms (see Sub-question 3)
- Confidence: MEDIUM (academic project from University of Athens)

**RecordLinkage Toolkit** — https://recordlinkage.readthedocs.io/
- Prototyping-focused Python toolkit
- Good for experimentation; not production-scale
- Confidence: HIGH (official docs)

**Zingg** — https://github.com/zinggAI/zingg
- Active learning, Python and Java; designed for big data (Spark-based)
- Overkill for the storytelling use case (designed for millions of records)
- Confidence: HIGH (official GitHub + docs)

#### JavaScript / TypeScript

There are NO production-quality JavaScript/TypeScript entity resolution libraries equivalent to Splink or dedupe. The ecosystem gap is real.

The practical approaches for a TypeScript/Node.js system are:
1. Call Python scripts via `child_process.spawn()` for batch ER runs
2. Use `@xenova/transformers` (transformers.js) for embedding generation natively in Node.js, then implement clustering logic in TypeScript
3. Use the existing `@harness/vector-search` package (already in this codebase) for embedding + Qdrant ANN search
4. Use Qdrant's vector similarity search to find near-duplicate character records

---

### Sub-question 2: Knowledge Graph Systems and Evolving Entity Identity

Knowledge graph (KG) literature has well-developed patterns for entities whose identity evolves over time.

**The core pattern: Entity Resolution + Knowledge Graph merge**
Source: https://linkurious.com/blog/entity-resolution-knowledge-graph/ and https://senzing.com/knowledge-graph/

The recommended architecture:
1. Every mention of a character creates a "mention node" (raw, unresolved)
2. ER runs over mention nodes and groups them into "entity nodes" (resolved)
3. The entity node holds the canonical representation; mention nodes retain their original text as evidence
4. When identity changes (unnamed -> named), only the entity node's canonical fields are updated — the mention history is preserved

**Temporal entity resolution** (academic framing):
- "Temporal record linkage addresses the problem where attribute values of entities can change over time"
- The key insight: an entity's attribute values (like name) are timestamped; the LATEST authoritative value wins
- Source: https://dl.acm.org/doi/10.1145/3533016 (Unsupervised Graph-Based Entity Resolution for Complex Entities)

**Practical pattern for "unnamed -> named" character evolution:**

The LlmLink paper (https://aclanthology.org/2025.coling-main.751/) addresses exactly this for long narratives:
- Dual-LLM approach: one LLM handles local named entity recognition, another handles cross-document coreference (linking the same entity across long distances)
- The local LLM "names" each mention as it appears (even if just "grey sweatpants guy")
- The distant LLM maintains a running mention memory and resolves cross-mention identity
- When a real name appears, it propagates backward through the cluster

**Key design principle from KG literature:**
Never delete the original mention. Instead, link mentions to a canonical node and update what the canonical node points to. This preserves evidence and allows identity to be corrected without data loss.

---

### Sub-question 3: Incremental Entity Resolution — State of the Art

**Progressive Entity Resolution: A Design Space Exploration** (March 2025)
- URL: https://arxiv.org/abs/2503.08298
- Four-step framework: Filtering → Weighting → Scheduling → Matching
- Key insight: "pay-as-you-go" approach that produces results continuously instead of waiting for full batch completion
- Filtering uses nearest-neighbor embedding search (better than traditional blocking)
- Scheduling algorithms: edge-centric (process highest-weight pairs first), node-centric (DFS/BFS variants), hybrid
- Limitation: this paper does NOT address dynamic adaptation based on ongoing feedback — the ordering is computed once upfront

**Entity Resolution for Streaming Data with Embeddings** (2024/2025)
- URL: https://hal.science/hal-05245956/document
- Adapts embedding-based ER to streaming data via dynamic graph embedding
- Each incoming record generates an embedding; ANN search finds candidate matches in the existing index
- Confident matches are merged immediately; uncertain pairs are queued for review
- This is the closest to what the storytelling system needs

**Incremental Entity Blocking over Heterogeneous Streaming Data** (MDPI Information, 2022)
- URL: https://www.mdpi.com/2078-2489/13/12/568
- Re-processes only the blocks affected by new data increments, not the entire dataset
- Schema-agnostic: works without knowing the fields in advance

**Practical incremental pattern (from research synthesis):**

The canonical approach for streaming/incremental ER is:

```
State:
  - Cluster registry: { clusterId -> canonical_record, member_mentions[] }
  - Embedding index (Qdrant or FAISS): { mentionId -> embedding }

On new mention arrival:
  1. Embed the new mention's description/name
  2. ANN search in index for k-nearest existing mentions
  3. For each candidate above similarity threshold T:
     a. Run pairwise LLM judge (see Sub-question 5)
     b. If match: assign to same cluster, update canonical
  4. If no match found: create new cluster
  5. Index the new mention embedding

On canonical update:
  - If a better name appears in the cluster, promote it to canonical
  - Keep all mention evidence attached to the cluster
```

---

### Sub-question 4: Embedding-Based Clustering for Entity Mentions

**The standard approach (HIGH confidence):**

1. Embed each character mention as a description string (name + any context)
   - Model: `all-MiniLM-L6-v2` (384-dim, already used by `@harness/vector-search` in this codebase)
   - Alternative for higher quality: `all-mpnet-base-v2` (768-dim, ~3x slower)

2. Compute pairwise cosine similarity between mention embeddings

3. Cluster using one of:
   - **DBSCAN**: density-based, no need to pre-specify number of clusters; handles noise (trash records become outliers with eps tuning); works well for character deduplication
   - **Agglomerative clustering with complete linkage**: all members of a cluster must be within threshold T of each other; conservative, reduces false merges
   - **Connected components**: if similarity(A,B) > T, draw an edge; clusters are connected components; simple and fast

4. Canonical name selection from a cluster:
   - **Most specific**: prefer actual proper names over descriptions ("John Smith" beats "the guy from CIS 405")
   - **Most frequent**: the name that appears most often across mentions
   - **Most recent**: the latest non-null proper name wins (handles unnamed -> named evolution)
   - **LLM selection**: prompt an LLM with the cluster members and ask it to choose the best canonical name

**Thresholds (empirical guidance):**
- cosine similarity > 0.85: very likely same entity (auto-merge)
- 0.65 - 0.85: uncertain (send to LLM judge)
- < 0.65: probably different (auto-reject)

These thresholds need calibration on real data from the system.

**Trash record detection:**
- Records where the extracted "name" is longer than ~50 characters, contains semicolons, or matches patterns like "mentioned; not present" should be flagged as low-quality before embedding
- Rule: if `name.includes(';') || name.length > 60 || /\b(not present|does not|mentioned)\b/i.test(name)` -> flag as trash, do not create a character record; log for review

**Node.js native embedding approach:**
- `@xenova/transformers` (npm) — port of Hugging Face transformers for Node.js
- URL: https://huggingface.co/docs/transformers.js
- Runs `all-MiniLM-L6-v2` natively in Node.js without Python subprocess
- The `@harness/vector-search` package already wraps this for the project

---

### Sub-question 5: LLM as Judge for Character Identity

**State of the art (HIGH confidence):**

The OpenSanctions Pairs study (https://arxiv.org/html/2603.11051) is the most directly applicable research:
- Uses LLMs to do pairwise entity matching for a real-world production system
- GPT-4o achieves 98.95% F1; DeepSeek-14B achieves 98.23% F1 — both vastly outperform rule-based baselines (91.33% F1)
- Key prompt framing: "Identify CONFLICTS, not similarities" — default assumption is POSITIVE (same entity) unless explicit contradictions are found
- Explicitly tells the model: "Name variations (transliterations, nicknames, titles) are common" and "Missing fields are normal"

**In-Context Clustering approach (LLM-CER):**
- URL: https://arxiv.org/html/2506.02509v1
- Instead of pairwise (A vs B), pack 9 records into one prompt and ask the LLM to cluster them
- Up to 150% higher accuracy and 5x fewer API calls vs pairwise
- Optimal set size: 9 records, 4 distinct entities per set
- Guardrail: if a record's similarity to out-of-cluster members > in-cluster members, regenerate the set

**Recommended prompt structure for character identity:**

```
You are resolving character identity in a story transcript.

Given these character records from the same story, determine which refer to the same person.
Group them into clusters. Characters may be referenced by nickname, description, role, or real name.

Records:
[1] Name: "the guy from CIS 405" | Description: "sits in front row, tall"
[2] Name: "grey sweatpants guy" | Description: "tall guy Quinn sees often"
[3] Name: "The Expander" | Description: "nickname for someone in class"
[4] Name: "Marcus" | Description: "guy from Quinn's class, they talked after"

Output JSON: { "clusters": [[1,2,3,4], [...], ...] }

Notes:
- Different names/nicknames/descriptions for the same person should be in the same cluster
- Assume records refer to the same person unless there is an explicit contradiction
- A description IS a valid identifier (e.g., "the tall guy" and "grey sweatpants" can be the same person)
```

**Cost management:**
- Use embedding pre-filtering to avoid sending all pairs to the LLM
- Only send pairs with similarity 0.65-0.85 (the uncertain zone) to LLM
- High-confidence matches (>0.85) auto-merge without LLM
- Low-confidence (<0.65) auto-reject without LLM
- Estimated: ~10-30% of pairs need LLM judgment; rest handled by embeddings alone

**Multi-agent RAG approach:**
- URL: https://www.mdpi.com/2073-431X/14/12/525
- Specialized agents: one for blocking/candidate generation, one for pairwise comparison, one for cluster validation
- Improves accuracy over single-LLM approaches by 3-8 F1 points on hard cases
- Worth considering if accuracy on character resolution is critical

---

## Key Takeaways

### The Core Problem Is Two Problems
1. **Extraction quality**: Bad records get created because the LLM extracts non-name text as a name. This needs a pre-extraction filter or a post-extraction validation step.
2. **Identity resolution**: Good records that refer to the same person need to be merged.

These need to be solved independently, in this order.

### Recommended Architecture for the Storytelling System

**Phase 0 — Extraction guard (immediate, no library needed):**
Before creating a character record, validate the extracted name:
- Reject names > 60 characters
- Reject names containing `;`, `|`, or phrases like "not present", "mentioned", "does not"
- Reject names that look like sentences (contain verbs)
- Flag for human review rather than silently discarding

**Phase 1 — Embedding-based pre-filter:**
On each new character extraction, embed the name + description and search Qdrant for similar existing characters. If cosine similarity > 0.85, propose an auto-merge. This uses the existing `@harness/vector-search` package with no new infrastructure.

**Phase 2 — LLM clustering (periodic batch):**
Every N transcripts (or on-demand), run LLM-CER-style clustering: pack all unresolved/uncertain character records (9 at a time) and ask Claude to group them. This handles the "grey sweatpants guy" -> "The Expander" -> "Marcus" chain.

**Phase 3 — Canonical name promotion:**
Within each cluster, apply priority rules:
1. Actual proper name (contains uppercase word that is not a common noun) wins
2. If multiple proper names: most recent wins (the one that appeared latest in the timeline)
3. All other mentions (descriptions, nicknames) become `aliases[]` on the canonical record
4. Never delete the original mention text — it becomes evidence

**Phase 4 — Retroactive re-linking:**
When a cluster merges (Marcus = grey sweatpants guy), all story moments and annotations that referenced the old records must be re-linked to the canonical. This requires the story moment table to hold a `characterId` FK that can be updated, not the raw name string.

### Incremental is the Right Model
The system should NOT re-run full ER on every transcript. The correct model is:
1. Keep an embedding index of all known character records (Qdrant)
2. On each new mention, search the index (Phase 1)
3. Queue uncertain cases for periodic batch LLM clustering (Phase 2)
4. Retroactively update links when clusters change (Phase 4)

### No Library Needed
For this specific use case (dozens to low hundreds of characters, not millions), no ER library is needed. The logic is:
- Embedding search (Qdrant — already exists)
- LLM pairwise or cluster judgment (Claude — already exists)
- Canonical selection (simple TypeScript logic)
- The complex libraries (Splink, dedupe, Zingg) add value for millions of structured records with many fields, not for this use case

## Sources

- Awesome Entity Resolution list: https://github.com/OlivierBinette/Awesome-Entity-Resolution
- Splink official docs: https://moj-analytical-services.github.io/splink/index.html
- Splink GitHub: https://github.com/moj-analytical-services/splink
- dedupe GitHub: https://github.com/dedupeio/dedupe
- dedupe API docs: https://docs.dedupe.io/en/latest/API-documentation.html
- GoldenMatch GitHub: https://github.com/benzsevern/goldenmatch
- Progressive Entity Resolution Design Space (arxiv, March 2025): https://arxiv.org/abs/2503.08298
- Entity Resolution for Streaming Data with Embeddings: https://hal.science/hal-05245956/document
- Incremental Entity Blocking over Streaming Data (MDPI): https://www.mdpi.com/2078-2489/13/12/568
- In-Context Clustering ER with LLMs (LLM-CER): https://arxiv.org/html/2506.02509v1
- LlmLink: Dual LLMs for Long Narrative Entity Linking: https://aclanthology.org/2025.coling-main.751/
- Literary Coreference with LLMs (Lions, Tigers, Bears): https://arxiv.org/html/2401.17922v1
- Major Entity Identification: https://arxiv.org/html/2406.14654v2
- OpenSanctions Pairs: LLM entity matching at scale: https://arxiv.org/html/2603.11051
- Multi-Agent RAG for Entity Resolution: https://www.mdpi.com/2073-431X/14/12/525
- Entity Resolution + Knowledge Graphs (Linkurious): https://linkurious.com/blog/entity-resolution-knowledge-graph/
- Senzing Knowledge Graphs: https://senzing.com/knowledge-graph/
- Golden Record problem (ResearchGate): https://www.researchgate.net/publication/320163463_Entity_Consolidation_The_Golden_Record_Problem
- Transformers.js (Node.js embeddings): https://huggingface.co/docs/transformers.js
- all-MiniLM-L6-v2 model: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
- Unsupervised Graph-Based ER for Complex Entities (ACM): https://dl.acm.org/doi/10.1145/3533016
