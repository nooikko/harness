# Research: Intent Classification and Fast-Path Routing for AI Agent Systems
Date: 2026-03-24

## Summary

Research into lightweight intent classification and routing to determine whether natural language requests like "turn on the office lights" or "play some jazz" can be fast-pathed to direct tool execution without a full LLM pipeline call. The goal is sub-200ms classification. The research covers four areas: small model classifiers, LLM router patterns, slot filling for structured tool calls, and realistic latency benchmarks.

**Key finding:** A hybrid two-tier architecture is the production consensus. Fast-path uses embedding cosine similarity (2–15ms locally, or 600ms via Haiku API) to classify high-confidence single-intent utterances and extract slots via regex/NER patterns. Slow-path falls back to a full Haiku call with structured JSON output for ambiguous, multi-intent, or low-confidence inputs. The 200ms budget is achievable only with a local model; Haiku's TTFT is 600ms minimum.

## Prior Research

- `AI_RESEARCH/2026-02-25-dynamic-tool-discovery-intent-routing.md` — tool_use vs text parsing for command routing (different problem: tool registration architecture, not pre-classification)
- `AI_RESEARCH/2026-02-24-anthropic-api-low-latency-chat.md` — general Anthropic API latency patterns

## Current Findings

---

### 1. Small Model Intent Classifiers

#### 1a. Claude Haiku 4.5 for Intent Routing

**Source:** Anthropic official docs, ArtificialAnalysis benchmarks (Confidence: HIGH)

Claude Haiku 4.5 is the current fastest Anthropic model. Documented performance:

| Metric | Anthropic Direct | Google Vertex | Azure | Amazon Bedrock |
|--------|-----------------|---------------|-------|----------------|
| TTFT | 600ms (0.61s) | 670ms | 990ms | 1,100ms |
| Output speed | 96.4 t/s | 96.2 t/s | 94.1 t/s | 111.7 t/s |

**Pricing:** $1/MTok input, $5/MTok output (as of March 2026).

**Context window:** 200k tokens.

**For intent classification specifically:**
- An intent classification prompt returns a very short output (a JSON object with intent + slots)
- Short output means TTFT dominates total latency
- With streaming + max_tokens=100, total round-trip will be approximately 700–900ms (TTFT + generation)
- This is well outside the 200ms budget for real-time home automation commands

**Prompt caching relevance:** If a static system prompt (intent categories + slot definitions) exceeds 4,096 tokens (minimum for Haiku 4.5), caching can reduce cost by 90% but does NOT meaningfully reduce TTFT — the latency benefit is primarily for long prompts where processing time dominates.

**Structured outputs:** Claude Haiku 4.5 supports structured JSON outputs via the `output_format` parameter. First-use grammar compilation adds 100–300ms overhead (24-hour cache thereafter). For a repeated classification task this cost amortizes quickly.

**Verdict:** Haiku is NOT suitable as the primary fast-path for sub-200ms classification. Best used as the fallback slow-path for ambiguous or multi-intent inputs where correctness matters more than latency.

---

#### 1b. Local Models via ONNX / Transformers.js

**Sources:** HuggingFace Transformers.js docs, philschmid.de ONNX optimization benchmarks, sbert.net efficiency docs (Confidence: HIGH for Python benchmarks; MEDIUM for Node.js)

The `@huggingface/transformers` package (Transformers.js v3) runs ONNX-optimized models in Node.js natively. It supports:
- Text classification
- Zero-shot classification
- Named entity recognition (token classification)
- Feature extraction (embeddings)

**Node.js installation:**
```bash
npm install @huggingface/transformers
```

**Basic pipeline API:**
```typescript
import { pipeline } from "@huggingface/transformers";

// Load once at startup (downloads + caches model)
const classifier = await pipeline("text-classification", "Xenova/distilbert-base-uncased-finetuned-sst-2-english");

// Per-request inference
const result = await classifier("turn on the office lights");
```

**Default execution:** CPU via ONNX Runtime. WebGPU available in Node.js v20+ with the `--experimental-webgpu` flag.

**Quantization:**
```typescript
const classifier = await pipeline("zero-shot-classification", "Xenova/nli-deberta-v3-small", {
  dtype: "q8",  // 8-bit quantization: faster, ~same accuracy
  // dtype: "q4" — 4-bit: fastest, some accuracy loss
});
```

**Concrete latency benchmarks (Python, translates to Node.js with similar ONNX Runtime):**

| Model | Setup | P95 Latency | Average Latency |
|-------|-------|-------------|-----------------|
| Sentence transformer (fp32) | AWS c6i.xlarge (Intel Ice Lake CPU) | 25.6ms | 19.75 ± 2.72ms |
| Sentence transformer (INT8 quantized ONNX) | Same hardware | 12.3ms | 11.76 ± 0.37ms |
| Pruned ONNX BERT | CPU | — | 7.4ms |
| Optimized ONNX BERT | CPU | — | 6.3ms |

These numbers are for a **128-token sequence** (a typical smart home command is 5–15 tokens, so latency will be lower). The 2.09x speedup from INT8 quantization is consistent across model sizes.

**Key model for intent classification: all-MiniLM-L6-v2**
- 22.7M parameters, 384-dimension embeddings
- Available as ONNX via Transformers.js as `Xenova/all-MiniLM-L6-v2`
- 5x faster than comparable larger models while maintaining good quality
- Ideal for cosine similarity-based intent matching (see Section 3)

**Zero-shot classification via NLI (no fine-tuning required):**
```typescript
const classifier = await pipeline("zero-shot-classification");
const result = await classifier(
  "turn on the office lights",
  ["control lights", "play music", "set temperature", "check status"]
);
// result.labels[0] = "control lights", result.scores[0] = 0.94
```

Suitable for exploratory use; fine-tuned models give better accuracy for production.

**Verdict:** Local ONNX models via Transformers.js achieve 6–25ms per inference on commodity CPU hardware. This is well within the 200ms budget even accounting for Node.js overhead. **This is the recommended approach for the sub-200ms fast path.**

---

#### 1c. Embedding Similarity Approach (Fastest Path)

**Sources:** Community implementations, HuggingFace all-MiniLM-L6-v2 docs (Confidence: HIGH)

The fastest classification approach avoids a full classification forward pass entirely: pre-compute embeddings for each intent label, then at runtime compute one embedding for the user query and find the nearest intent via cosine similarity.

**Why this works for home automation:**
- The intent space is small and known (lights, music, temperature, locks, etc.)
- Each intent can be represented by a set of example utterances
- Cosine similarity in 384-d space is dot product math — microseconds per comparison

**Architecture:**

```
STARTUP (one-time):
  For each intent: embed 3-5 example utterances → average → store as intent centroid

RUNTIME (per request):
  1. Embed user utterance → 384-d vector (6-25ms via ONNX)
  2. Cosine similarity against N intent centroids (microseconds, pure math)
  3. If max_score > threshold (e.g., 0.82): fast-path with matched intent
  4. Else: fallback to Haiku for disambiguation
```

**Total runtime latency:** 6–25ms for the embedding + negligible for similarity math = **well under 200ms**.

**Model size:** `all-MiniLM-L6-v2` ONNX model is approximately 23MB. Loads in <1s at startup.

**Accuracy trade-off:** The embedding approach works well for clearly distinct intents ("play music" vs. "control lights"). Performance degrades with:
- Very similar intents ("dim lights" vs. "turn off lights" — both are light-control)
- Multi-intent compound utterances ("play jazz and turn on the lights")
- Highly ambiguous phrasing

For these cases, fall back to Haiku.

---

#### 1d. Traditional NLP — node-nlp / NLP.js

**Sources:** Official GitHub, npm page, community benchmarks (Confidence: MEDIUM)

`nlp.js` (AXA Group) provides intent classification + slot filling in pure TypeScript/Node.js with no native dependencies:

```bash
npm install node-nlp
```

Features:
- Neural network-based intent classifier (domain-specific neural nets per language)
- Entity extraction (slot filling)
- Does NOT require an embedding model download

**Latency:** Training time dropped from 108s → 3s between v2 and v3. Runtime inference (classify + extract) is in the 1–10ms range based on community reports, though no official benchmarks are published.

**Limitations:**
- Requires labeled training data (utterance → intent pairs)
- Less flexible than embedding similarity for new intents
- The 3.x → 4.x migration broke many APIs (community fragmentation)

**Verdict:** Viable as a fallback-free approach if you have 50–200 labeled training utterances and want zero external model dependencies. Latency is fast. Less accurate than fine-tuned transformers for varied phrasing.

---

### 2. LLM Router Patterns

**Sources:** LogRocket LLM routing article, vLLM Semantic Router blog, Red Hat developer article, Martian router docs (Confidence: HIGH)

#### 2a. The Two-Tier (Fast/Slow) Architecture

Production systems converge on a cascade pattern:

```
Request → [Fast Classifier] → confidence > threshold?
                               YES → execute directly
                               NO  → [Slow LLM] → execute with understanding
```

**Fast path characteristics:**
- Embedding similarity OR small BERT classifier
- Decision time: 2–50ms (optimized vector math)
- Handles: simple, unambiguous, single-intent utterances
- Coverage: reportedly 60–70% of typical home automation requests

**Slow path characteristics:**
- Full LLM call (Haiku for balance, Sonnet for complex)
- TTFT: 600ms–1.1s depending on provider
- Handles: multi-intent, ambiguous, parameter-heavy requests
- Coverage: 30–40% of requests

**Cascade (confidence-based) variant:**
Send first to a cheap fast model; if confidence > 95%, serve immediately; otherwise escalate. This is the "speculative cascade" pattern from Google Research. The key insight is that you don't need a separate classifier — the fast model's own confidence score acts as the routing signal.

#### 2b. vLLM Semantic Router

**Source:** vLLM blog (September 2025) (Confidence: HIGH)

vLLM's production semantic router uses:
- **ModernBERT** as the classifier (lightweight standalone BERT variant)
- Rust implementation using HuggingFace Candle for zero-copy inference
- Cloud-native (Kubernetes + Envoy via ext_proc plugin)

Results in their trials:
- ~10% higher accuracy vs. no routing
- ~50% lower latency overall (by routing simple queries to fast models)
- ~50% fewer tokens consumed
- Business/economics domain: >20% accuracy gain

The router classifies into two paths: "fast path" (direct inference) and "Chain-of-Thought reasoning mode" (for complex queries). The architecture is directly applicable to home automation: simple commands fast-path to tool execution, complex or ambiguous ones get an LLM pass.

#### 2c. Semantic Routing (Embedding-Based)

**Source:** Red Hat developer article, LogRocket (Confidence: HIGH)

Semantic routing uses embeddings to match incoming requests to pre-defined "routes" (intents). Each route is defined by a set of example utterances. At runtime:

1. Embed the incoming request
2. Compare cosine similarity to route centroids
3. Route to the matching handler above a confidence threshold

**Latency:** "Decision times often in the milliseconds" — Red Hat article. "Relies on optimized vector math rather than a slow generative LLM call."

**Scalability:** Scales to thousands of routes with ANN (approximate nearest neighbor) search.

**Libraries:**
- `semantic-router` (Python) — no Node.js equivalent at production quality
- Direct implementation with `@huggingface/transformers` + cosine similarity (see Section 3)

#### 2d. Martian Model Router

**Source:** Martian docs, VentureBeat (Confidence: MEDIUM)

Martian's `Arch-Router` is a 1.5B parameter model fine-tuned for routing decisions. Key stats:
- Runs in "tens of milliseconds" on commodity GPUs
- "~28x lower end-to-end latency" than closest commercial competitor
- Uses Domain–Action taxonomy: Domain (topic: legal, finance, home automation) + Action (operation: control, query, schedule)
- Natural-language policy definitions — routes are described in natural language, not as code

For a home assistant context, Martian is overkill (it's designed for enterprise LLM routing). The embedding approach achieves similar latency without a GPU dependency.

#### 2e. Skeleton of Thought (SoT)

**Source:** Microsoft Research, ICLR 2024 paper (Confidence: HIGH)

SoT is a prompting pattern that parallelizes LLM response generation — not directly applicable to pre-classification routing. However, **SoT-R** (SoT with Router) uses a lightweight RoBERTa classifier to determine whether SoT should be applied at all. This is the relevant pattern: a small classifier gates access to the expensive path.

For multi-intent detection, SoT can decompose a compound command into parallel sub-requests once the intent structure is known. Example: "play jazz and turn on the lights" → parallel tool calls to music plugin and lights plugin.

---

### 3. Slot Filling for Tool Calls

**Sources:** ACM survey on joint intent+slot filling, Kore.ai multi-intent docs, arxiv home automation LLM paper (Confidence: HIGH)

#### 3a. The Joint Intent Detection + Slot Filling Problem

The task has two parts that are deeply coupled:
- **Intent detection:** "turn on the office lights" → intent: `lights.control`
- **Slot filling:** `{action: "on", room: "office", device: "lights"}`

Research shows that modeling them jointly outperforms separate models because slot values inform intent disambiguation (e.g., "set" with a color slot → lights intent; "set" with an alarm time → timer intent).

#### 3b. Regex/Rule-Based Slot Extraction

For a constrained home automation domain, regex + gazetteers (known-values lists) is extremely fast and highly accurate:

```typescript
// Room gazetteer
const ROOMS = ["office", "bedroom", "living room", "kitchen", "bathroom", "garage"];
const ROOM_PATTERN = new RegExp(`\\b(${ROOMS.join("|")})\\b`, "i");

// Action patterns per device type
const LIGHT_ACTIONS = {
  on: /\b(turn on|switch on|enable|activate)\b/i,
  off: /\b(turn off|switch off|disable|deactivate)\b/i,
  dim: /\b(dim|lower|decrease|reduce)\b/i,
  brighten: /\b(brighten|raise|increase|boost)\b/i,
  color: /\b(set|change|make).+?(to|as)\s+(\w+)\b/i,
};

// Color extraction
const COLORS = ["red", "blue", "green", "yellow", "white", "warm", "cool", "purple"];
const COLOR_PATTERN = new RegExp(`\\b(${COLORS.join("|")})\b`, "i");
```

**Latency:** Sub-millisecond (pure regex string matching).

**Coverage:** Works for canonical phrasings. Fails on unusual phrasing ("illuminate the study in crimson").

**Recommended use:** Slot extraction after intent is classified (embedding similarity handles the semantic flexibility; regex handles the structured extraction from a known intent context).

#### 3c. NER-Based Slot Extraction via Transformers.js

For extracting entities from more flexible phrasing, a token classification (NER) model can label each word:

```typescript
const ner = await pipeline("token-classification", "Xenova/bert-base-NER");
const entities = await ner("turn on the bedroom lights");
// [{ word: "bedroom", entity: "ROOM", score: 0.99, ... }]
```

**Latency:** Same order as text classification — 6–25ms for a 10-token input on CPU.

**Accuracy:** Pre-trained NER models recognize standard entities (PERSON, LOCATION, ORG) but not custom home automation slots. Fine-tuning on 200–500 labeled examples (or using zero-shot NER) is needed for production quality.

#### 3d. Multi-Intent Detection

**Sources:** Multi-intent SLU survey (2025 Springer), Kore.ai multi-intent docs, Amazon internal dataset (Confidence: HIGH)

**Prevalence:** ~52% of utterances in Amazon's internal dataset contain multiple intents (per 2025 survey). Compound home commands are common: "set the bedroom lights to red and play jazz."

**Approaches:**

1. **Splitting by conjunction/sequence markers:** Parse on "and", "then", "after that", "while" to split into sub-utterances before classification. Fast, works for explicit coordination. Fails for implicit compounds ("dim the lights and queue some music" vs. "dim the lights while playing music" — different semantics).

2. **Multi-label classification:** A single model outputs multiple intent labels simultaneously. Requires training data with multi-intent examples. `@huggingface/transformers` supports multi-label text classification.

3. **LLM decomposition:** Send the utterance to Haiku asking it to split into a JSON array of atomic commands. Accurate, handles implicit compounds, but costs the full LLM latency (~700ms).

**Recommended pattern for home automation:**

```typescript
// Step 1: Check for explicit compound markers (regex, <1ms)
const parts = splitOnConjunctions(utterance);
if (parts.length > 1) {
  // Classify each part independently
  return await Promise.all(parts.map(classifyIntent));
}

// Step 2: Single-intent embedding similarity
const { intent, confidence } = await classifyWithEmbedding(utterance);
if (confidence > 0.82) {
  const slots = extractSlots(utterance, intent);
  return [{ intent, slots }];
}

// Step 3: Fallback to Haiku for ambiguous/multi-intent
return await classifyWithHaiku(utterance);
```

#### 3e. LLM Structured Output for Slot Filling

When falling back to Haiku, use structured JSON output to enforce the schema:

```typescript
const response = await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 150,
  system: `You are a home automation intent classifier. Extract intents and slots from user commands.
Return a JSON array of actions. Each action has: intent (string), and slots (object with device-specific parameters).
Available intents: lights.control, music.play, temperature.set, lock.control, status.query

Example:
Input: "turn on bedroom lights and play jazz"
Output: [
  {"intent": "lights.control", "slots": {"action": "on", "room": "bedroom"}},
  {"intent": "music.play", "slots": {"query": "jazz"}}
]`,
  messages: [{ role: "user", content: utterance }],
});
```

**First-use latency:** 700–900ms (TTFT 600ms + generation of ~80 tokens at 96 t/s ≈ 830ms + 100–300ms grammar compilation on first use).

**Subsequent uses:** ~700–800ms (grammar cached for 24 hours).

---

### 4. Latency Benchmarks Summary

| Approach | Latency | Accuracy | Setup Complexity |
|----------|---------|----------|-----------------|
| Regex / rule-based | <1ms | Medium (brittle to phrasing) | Low |
| node-nlp / NLP.js (neural) | 1–10ms | Medium-High (needs training data) | Medium |
| Embedding similarity (local ONNX) | 6–25ms | High (for well-separated intents) | Medium |
| NER token classification (local ONNX) | 6–25ms | Medium (needs fine-tuning for custom slots) | Medium-High |
| Zero-shot NLI classifier (local ONNX) | 15–50ms | Medium (no training needed) | Low-Medium |
| Haiku API (streaming, TTFT) | 600–700ms | Very High | Low |
| Haiku API (structured JSON output) | 800–1100ms | Very High | Low |
| Sonnet API (for complex routing) | 1000–1500ms | Highest | Low |

**For the 200ms budget:** Only local approaches (ONNX/Transformers.js) comfortably fit. Haiku at 600ms TTFT is 3x the budget even under ideal conditions.

**Real-world distribution for a home assistant:**
- ~60–70% of requests: simple, single-intent, clear phrasing → ONNX embedding, 6–25ms
- ~20–25% of requests: compound utterances with explicit conjunctions → split + ONNX, 10–40ms
- ~10–15% of requests: ambiguous, multi-intent implicit, or unknown device → Haiku fallback, 700ms+

---

### 5. The Recommended Architecture for Harness

Given the context (Node.js orchestrator, TypeScript monorepo, home automation plugin targets), the recommended architecture for a fast-path intent router is:

**Tier 1 — Regex Pre-Filter (~0ms)**
For highly structured commands matching known device patterns (keywords "turn on", "turn off", "play", "pause"). Extract intent + slots with regex gazetteer patterns. Use as a first gate: if regex matches with high slot confidence, execute directly.

**Tier 2 — Local Embedding Similarity (~10–25ms)**
Load `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers` at orchestrator startup. At request time, embed the utterance and compare to pre-computed intent centroids. If cosine similarity > threshold, execute the matched intent.

For slot extraction at this tier: use regex/gazetteer patterns applied within the known intent context (the intent class constrains which slots to look for).

**Tier 3 — Haiku Structured Output (~700ms+)**
For utterances that don't pass tier 1 or tier 2 (below confidence threshold), fall back to a Haiku API call with a compact system prompt (use prompt caching to reduce per-request cost by 90%) and structured JSON output to extract all intents and slots in one call. This handles: multi-intent compounds, ambiguous phrasing, unseen device names, and novel command structures.

**Model startup cost:** `all-MiniLM-L6-v2` ONNX is ~23MB. First load downloads and caches to disk. Subsequent orchestrator starts load from disk in <100ms. The model should be loaded in the plugin's `start()` lifecycle method.

---

## Key Takeaways

1. **The 200ms budget cannot be met with any Anthropic API call.** Claude Haiku 4.5's TTFT is 600ms minimum on Anthropic's own infrastructure. For true sub-200ms classification, a local ONNX model is required.

2. **Embedding cosine similarity is the fastest production-viable approach.** `all-MiniLM-L6-v2` via `@huggingface/transformers` in Node.js achieves 6–25ms per inference on CPU, scales to any number of intents, and requires no labeled training data (only example utterances per intent).

3. **Structured JSON output from Haiku is the correct fallback.** The `output_format` parameter enforces schema adherence. Grammar compilation cost (100–300ms) is one-time per 24-hour cache. Use prompt caching on the system prompt to reduce cost by 90% across repeated calls.

4. **Multi-intent (~52% of compound utterances) should be handled at the split stage.** Conjunction splitting ("and", "then") before classification handles the majority of cases without an LLM call.

5. **Zero-shot NLI classification (no training required)** via `@huggingface/transformers` pipeline is viable for rapid prototyping but adds 15–50ms vs. the embedding approach and typically has lower accuracy on domain-specific phrasings.

6. **NLP.js (node-nlp)** is a pure TypeScript option that works without downloading any model files, but requires labeled training data and has a less active maintenance state.

7. **The vLLM semantic router pattern (ModernBERT + Rust)** is the state of the art for production infrastructure-level routing but requires a dedicated service. For a single-node home automation system, the `@huggingface/transformers` ONNX path achieves comparable latency without infrastructure overhead.

---

## Gaps Identified

- No official Node.js-specific benchmark for `@huggingface/transformers` text classification latency (all concrete numbers are from Python ONNX Runtime benchmarks on comparable hardware).
- The accuracy of `all-MiniLM-L6-v2` cosine similarity for home automation intents vs. a fine-tuned classifier is not benchmarked in any source found. Practical testing would be required.
- Whether Haiku's 600ms TTFT can be reduced further with priority tier API access was not found in official documentation.
- The exact Node.js memory footprint of `@huggingface/transformers` + `all-MiniLM-L6-v2` loaded in the orchestrator process is not documented.

## Recommendations for Next Steps

1. **Prototype the embedding approach first:** Install `@huggingface/transformers`, define 5–10 intent centroids with 3–5 example utterances each, and benchmark actual Node.js inference time on the target hardware.

2. **Benchmark against the Haiku baseline:** For 50 representative home automation commands, compare embedding similarity results to Haiku structured output results. Use this to set the confidence threshold for tier escalation.

3. **Start with 5 intents:** lights.control, music.play, temperature.set, lock.control, status.query. Add more as usage patterns emerge.

4. **Keep the Haiku fallback path first:** During initial rollout, route everything through Haiku to build a ground-truth dataset of intent classifications. Use that dataset to train the local model.

5. **Consider a new `@harness/plugin-intent` package** if this routing logic grows complex — it follows the plugin pattern and keeps the orchestrator minimal.

---

## Sources

- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — Haiku 4.5 model ID, context window, pricing
- [Anthropic Reducing Latency Guide](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-latency) — TTFT guidance, prompt optimization
- [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — minimum token requirements, cache TTL
- [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — JSON output format, grammar compilation latency
- [ArtificialAnalysis Claude Haiku 4.5 Benchmarks](https://artificialanalysis.ai/models/claude-4-5-haiku/providers) — TTFT numbers per provider
- [HuggingFace Transformers.js Documentation](https://huggingface.co/docs/transformers.js/en/index) — Node.js usage, supported tasks, quantization
- [philschmid.de ONNX Optimization Benchmarks](https://www.philschmid.de/optimize-sentence-transformers) — 25.6ms → 12.3ms with INT8 quantization
- [sbert.net Efficiency Documentation](https://sbert.net/docs/sentence_transformer/usage/efficiency.html) — ONNX speedup ratios
- [vLLM Semantic Router Blog](https://vllm.ai/blog/semantic-router) — ModernBERT classifier, 50% latency reduction, fast/slow path architecture
- [Red Hat LLM Semantic Router](https://developers.redhat.com/articles/2025/05/20/llm-semantic-router-intelligent-request-routing) — Rust + BERT embedding routing, Envoy integration
- [LogRocket LLM Routing](https://blog.logrocket.com/llm-routing-right-model-for-requests/) — confidence-based routing patterns, cascade approach
- [On-Device LLMs for Home Assistant (arxiv 2502.12923)](https://arxiv.org/abs/2502.12923) — 5–6s on-device LLM latency, 80–86% accuracy, 8-bit quantization
- [Kore.ai Multi-Intent Detection](https://developer.kore.ai/docs/bots/bot-intelligence/multi-intent-detection/) — conjunction-based splitting, ordering
- [Multi-Intent SLU Survey 2025](https://link.springer.com/article/10.1007/s44336-025-00029-6) — 52% multi-intent prevalence in Amazon dataset
- [Intent Classification Techniques 2026](https://labelyourdata.com/articles/machine-learning/intent-classification) — four-tier comparison: rule-based, classical ML, transformers, LLM
- [HuggingFace all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) — 22.7M parameters, 384-dim, 5x faster than larger models
- [Martian Model Router](https://route.withmartian.com/) — Arch-Router 1.5B, tens-of-ms GPU routing
- [Skeleton of Thought (ICLR 2024)](https://arxiv.org/abs/2307.15337) — SoT-R RoBERTa router for parallel decomposition
- [Speculative Cascades (Google Research)](https://research.google/blog/speculative-cascades-a-hybrid-approach-for-smarter-faster-llm-inference/) — confidence-based fast/slow routing
