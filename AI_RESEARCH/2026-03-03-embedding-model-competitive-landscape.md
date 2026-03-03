# Research: Embedding Model Competitive Landscape (Early 2026)
Date: 2026-03-03

## Summary

Comprehensive comparison of the top-performing embedding models for text retrieval as of early 2026. Focus: retrieval quality (nDCG@10), short-text performance, commercial API pricing, and open-source/self-hostable options. The benchmark space shifted substantially in 2025-2026 with three major entrants: Google Gemini Embedding (top MTEB overall, July 2025), Voyage 4 family (MoE architecture, January 2026), and Qwen3-Embedding-8B (top multilingual MTEB, June 2025).

## Prior Research

- `AI_RESEARCH/2026-03-03-voyage-ai-embedding-benchmarks.md` — Deep dive on voyage-3-large vs voyage-3.5 with agentset.ai nDCG@10 scores. Key finding: voyage-3-large (nDCG@10 0.837) outperforms voyage-3.5 (0.816) on accuracy. Read this first for Voyage-specific detail.

---

## Current Findings

### 1. Top Commercial API Models (Current as of Early 2026)

#### Gemini Embedding (gemini-embedding-001) — Google
**Status:** Generally available as of July 2025.
- **MTEB Multilingual score:** 68.32 (ranked #1 on MTEB Multilingual leaderboard at launch, +5.09 margin over second-best)
- **MTEB English v2 score:** 73.30
- **Dimensions:** 3072 (default); supports 1536, 768 via MRL (Matryoshka Representation Learning)
- **Context window:** 2048 tokens (SHORT — a significant limitation)
- **Pricing:** $0.15/1M tokens (standard), $0.075/1M tokens (batch); free tier available
- **Retrieval improvement over prior Google model (text-embedding-004):** +9.0 on MTEB retrieval category
- **Note:** Previous model `text-embedding-004` deprecated August 2025

**Limitation for this use case:** 2048-token context window is short, though adequate for 1-3 sentence memory summaries. The MTEB overall score of 68.32 is higher than voyage-3-large's reported 66.8 on the same benchmark, but this is the aggregate score. Retrieval-specific nDCG@10 comparison data is not directly available in public sources.

Sources: [Google Developers Blog — Gemini Embedding GA](https://developers.googleblog.com/gemini-embedding-available-gemini-api/), [Gemini Embedding paper (arXiv:2503.07891)](https://arxiv.org/html/2503.07891v1)

---

#### Voyage 4 Family — Voyage AI / MongoDB (January 2026)
**Status:** Released January 15, 2026. These are the CURRENT generation Voyage models.

| Model | Architecture | Relative Accuracy | Price/1M tokens |
|-------|-------------|------------------|-----------------|
| voyage-4-large | MoE (mixture-of-experts) flagship | +8.20% over Gemini Embedding 001, +14.05% over OpenAI v3 Large | Not yet published |
| voyage-4 | Mid-tier MoE | ~1.87% below voyage-4-large | $0.06 |
| voyage-4-lite | Lightweight MoE | ~4.80% below voyage-4-large | $0.02 |
| voyage-4-nano | Open-weight (Apache 2.0) | Not reported | Free (HuggingFace) |

- **Dimensions:** 2048, 1024, 512, 256 (all models, via Matryoshka learning)
- **Context window:** Not published in announcement (likely 32K based on prior generation)
- **Architecture innovation:** First Voyage generation to use MoE architecture; "serving costs 40% lower than comparable dense models"
- **Shared embedding space:** All four models share the same embedding space (novel feature — enables cross-model retrieval)
- **Pricing note:** voyage-4-large pricing not yet confirmed; $0.12/1M was listed in one third-party source. voyage-4 at $0.06/1M was confirmed.

**Key claim:** voyage-4-large surpasses Gemini Embedding-001 by 8.20% on Voyage AI's 100-dataset evaluation. This is Voyage AI's own benchmark, not a third-party MTEB submission. These claims should be treated as MEDIUM confidence until MTEB leaderboard results are published.

Source: [Voyage AI Blog — Voyage 4 announcement](https://blog.voyageai.com/2026/01/15/voyage-4/)

---

#### voyage-3-large — Voyage AI (January 2025, still available)
This is the model currently under evaluation for the project. Detailed benchmarks in prior research file.
- **MTEB overall score:** 66.8 (third-party source)
- **agentset.ai nDCG@10:** 0.837 (overall across BEIR datasets)
- **Dimensions:** 1024 (default); 256, 512, 2048 (via Matryoshka)
- **Context window:** 32,000 tokens
- **Pricing:** $0.18/1M tokens (first 200M free)
- **Anthropic docs status:** Still listed as "Best quality" recommendation as of March 2026

---

#### voyage-3.5 — Voyage AI (May 2025)
- **agentset.ai nDCG@10:** 0.816 (vs voyage-3-large's 0.837 — 2.5% lower accuracy)
- **Latency:** ~13ms vs voyage-3-large's 113ms (8.7x faster)
- **Pricing:** $0.06/1M tokens (3x cheaper than voyage-3-large)
- **Context window:** 32,000 tokens
- Note: voyage-3.5 does NOT outperform voyage-3-large on accuracy. It is the mid-tier successor to voyage-3 (not to voyage-3-large).

---

#### OpenAI text-embedding-3-large
- **MTEB score:** 64.6 overall
- **Dimensions:** 3072 (default); configurable down to 256 via shortening
- **Context window:** 8,192 tokens
- **Pricing:** $0.13/1M tokens (~$0.00013/1K)
- **Status:** Well below voyage-3-large on accuracy; voyage-3-large beats it by ~9.74%

Source: [OpenAI API docs](https://platform.openai.com/docs/models/text-embedding-3-large)

---

#### Cohere Embed v4 (Multimodal)
- **MTEB score:** 65.2 overall
- **Dimensions:** 1024 (note: one source cites 768 — unconfirmed)
- **Context window:** 512 tokens (SHORT — major limitation for document embedding)
- **Pricing:** $0.10/1M tokens
- **Capability:** Multimodal (text + images)
- **Note:** Designed for "noisy real-world data" and multimodal search. For pure text retrieval the context window of 512 tokens is a significant constraint.

Source: [Cohere AWS Bedrock docs](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-embed-v4.html)

---

#### Jina Embeddings v3 (released September 2024)
- **MTEB English score:** 65.52 overall; 2nd on MTEB English leaderboard at launch (for models <1B parameters)
- **Dimensions:** Not specified in sources
- **Context window:** 8,192 tokens
- **Architecture:** Task LoRA (separate LoRA adapters per task type — retrieval, classification, STS, etc.)
- **Pricing:** Available via Jina AI API; pricing not found in research

Source: [Jina Embeddings v3 paper (arXiv:2409.10173)](https://arxiv.org/abs/2409.10173)

---

#### Jina Embeddings v5 (released early 2026)
- **MTEB Multilingual (v2) — jina-v5-text-small:** 67.0 average task score
- **MTEB Multilingual (v2) — jina-v5-text-nano:** 65.5 average task score
- **Parameters:** 596M (small), 212M (nano)
- **Dimensions:** 1024 (small), 768 (nano)
- **Context window:** 32,000 tokens
- **License:** Open source, available on Hugging Face
- **Pricing:** Free (self-hosted)

Source: [jina-embeddings-v5 paper (arXiv:2602.15547)](https://arxiv.org/html/2602.15547)

---

### 2. Top Open-Source / Self-Hostable Models

#### Qwen3-Embedding-8B — Alibaba (June 2025)
- **MTEB Multilingual score:** 70.58 (#1 on MTEB Multilingual leaderboard as of June 2025)
- **MTEB English v2 retrieval score (0.6B model):** 61.83 (individual task)
- **Dimensions:** 4096 (8B), 2560 (4B), 1024 (0.6B)
- **Context window:** 32,768 tokens (all sizes)
- **License:** Apache 2.0 (open source, freely usable commercially)
- **Pricing:** Free to self-host
- **VRAM requirements:** 8B model requires ~16GB VRAM in BF16 — does NOT fit RTX 3070 (8GB). 4B requires ~8-10GB — marginal. 0.6B requires ~2-3GB — fits comfortably on RTX 3070.
- **Note:** The 70.58 MTEB Multilingual score outperforms Gemini Embedding-001's 68.32. However, this is the 8B model. The 0.6B model would be needed for RTX 3070.

| Size | MTEB Multilingual | VRAM (approx) | RTX 3070 (8GB) |
|------|------------------|---------------|-----------------|
| 0.6B | Not reported in sources (MTEB Eng v2: ~64-65) | ~2-3GB | YES |
| 4B | Not reported in sources | ~8-10GB | Marginal |
| 8B | 70.58 (top of leaderboard) | ~16GB | NO |

Source: [Qwen3 Embedding blog](https://qwenlm.github.io/blog/qwen3-embedding/), [Qwen3-Embedding-0.6B HuggingFace](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B)

---

#### Nomic Embed Text v2 MoE — Nomic AI
- **BEIR score:** 52.86 nDCG@10
- **MIRACL score:** 65.80
- **Parameters:** 475M total, 305M active (MoE architecture)
- **Dimensions:** 768 (default); down to 256 via Matryoshka learning
- **Context window:** 512 tokens (SHORT — same limitation as Cohere v4)
- **License:** Apache 2.0 (open source)
- **VRAM requirements:** ~1.5-2GB — easily fits RTX 3070
- **Note:** The 512-token context limit is a significant constraint for document embedding, but not for 1-3 sentence queries.

Source: [Nomic Embed Text v2 MoE HuggingFace](https://huggingface.co/nomic-ai/nomic-embed-text-v2-moe)

---

#### BGE-M3 — Beijing Academy of AI
- **MTEB score:** 63.0 overall
- **Dimensions:** 1024
- **Context window:** 8,192 tokens
- **License:** MIT (open source)
- **Architecture:** Hybrid retrieval (dense + sparse + multi-vector ColBERT)
- **VRAM requirements:** ~2-3GB — fits RTX 3070
- **Note:** Supports multilingual (100+ languages). The hybrid retrieval modes are distinctive; most embedding services only support dense retrieval.

---

#### E5-Mistral-7B-Instruct — Microsoft
- **BEIR nDCG@10:** 51.2 (per ailog source)
- **Parameters:** 7B (Mistral base)
- **VRAM requirements:** ~14-16GB in BF16 — does NOT fit RTX 3070
- **License:** MIT
- **Note:** Strong retrieval quality but requires at minimum a 16GB GPU.

---

#### Jina Embeddings v5 (see commercial section — also self-hostable)
- Smaller variants (nano at 212M) easily fit on RTX 3070
- 32K context window

---

### 3. BEIR nDCG@10 Comparison Table

From ailog BEIR 2.0 leaderboard (note: this leaderboard may not include newest models):

| Model | BEIR nDCG@10 | Notes |
|-------|-------------|-------|
| Voyage-Large-2 | 54.8% | Older Voyage generation (pre-voyage-3) |
| Cohere Embed v4 | 53.7% | |
| BGE-Large-EN | 52.3% | |
| Gemini-embedding-001 | 52.1% | |
| OpenAI text-3-large | 51.9% | |
| Qwen3-Embedding-8B | 51.5% | |
| E5-Mistral-7B | 51.2% | |

From agentset.ai (across BEIR datasets — DBPedia, FiQa, SciFact, MSMARCO, ARCD):

| Model | nDCG@10 | Latency |
|-------|---------|---------|
| voyage-3-large | 0.837 | 113ms |
| voyage-3.5 | 0.816 | 13ms |
| voyage-3.5-lite | 0.803 | 11ms |

**Important:** These two benchmark sources use different evaluation methodologies and dataset sets, so scores are not directly comparable across tables. The agentset.ai scores (0.837 etc.) use a specific 5-dataset BEIR subset; the ailog scores (54.8% etc.) use a broader BEIR 2.0 set.

The MTEB leaderboard was not directly accessible (returns JavaScript SPA content), so exact current rankings for voyage-4-large are not confirmed from a third-party source.

---

### 4. Models That Outperform voyage-3-large

Based on available data:

**Possibly yes (Confidence: MEDIUM):**
- **Gemini Embedding-001:** MTEB overall 68.32 vs voyage-3-large's 66.8. This is the aggregate MTEB score. Whether Gemini leads specifically on retrieval nDCG@10 against voyage-3-large is not confirmed in available sources. The BEIR 2.0 table shows Gemini at 52.1% vs Voyage-Large-2 at 54.8% — but Voyage-Large-2 is an older model than voyage-3-large.
- **Voyage 4-large:** Claims to outperform Gemini Embedding-001 by 8.20% on Voyage AI's proprietary 100-dataset evaluation. If Gemini already leads voyage-3-large on aggregate MTEB, then voyage-4-large likely does too. Confidence is MEDIUM because this claim is from Voyage AI's own benchmark without independent MTEB submission at time of research.
- **Qwen3-Embedding-8B:** MTEB Multilingual 70.58 (above Gemini's 68.32). However, this is the 8B model that requires ~16GB VRAM for self-hosting, and its retrieval-specific nDCG@10 score was not isolated in available sources.

**No (Confidence: HIGH):**
- OpenAI text-embedding-3-large (MTEB 64.6) — substantially behind voyage-3-large
- Cohere Embed v4 (MTEB 65.2) — behind voyage-3-large
- voyage-3.5 (nDCG@10 0.816 vs 0.837) — behind voyage-3-large on accuracy
- Nomic Embed v2 (BEIR 52.86%) — significantly behind
- Jina v3 (MTEB 65.52) — behind voyage-3-large

---

### 5. Open-Source Models That Fit RTX 3070 (8GB VRAM) vs. voyage-3-large Quality

**Fits in 8GB VRAM and reasonable quality:**

| Model | Est. VRAM | MTEB Score | Context | Quality vs v3-large |
|-------|-----------|-----------|---------|---------------------|
| Qwen3-Embedding-0.6B | ~2-3GB | ~64-65 (est.) | 32K | Substantially below |
| Nomic Embed v2 MoE | ~1.5-2GB | BEIR 52.86 | 512 tokens | Substantially below |
| BGE-M3 | ~2-3GB | 63.0 MTEB | 8K | Substantially below |
| Jina v5 nano (212M) | ~1-1.5GB | 65.5 MTEB multilingual | 32K | Moderately below |
| all-MiniLM-L6-v2 | <1GB | 56.3 MTEB | 512 tokens | Far below |

**Does NOT fit in 8GB VRAM:**
- Qwen3-Embedding-8B (~16GB) — top of leaderboard but requires 2x VRAM
- E5-Mistral-7B (~14-16GB) — does not fit
- Most 7B+ decoder-based embedding models — do not fit

**Summary:** No open-source model that fits on an RTX 3070 comes close to voyage-3-large quality (nDCG@10 0.837). The best fit option is Qwen3-Embedding-0.6B (quality estimated around 0.75-0.80 nDCG based on its MTEB score relative to larger models) with the full 32K context window. Nomic Embed v2 MoE is efficient but limited by its 512-token context window.

---

### 6. Short Text Retrieval Considerations (1-3 Sentence Memory Summaries)

For the specific use case of embedding 1-3 sentence agent memory summaries:

- **Context window is NOT a constraint for any modern model** — even Cohere v4's 512 tokens and Nomic v2's 512 tokens can accommodate 1-3 sentences (typically 30-150 tokens)
- **Short text retrieval favors smaller, faster models** — sentence-level models (SBERT family, E5-small) were specifically designed for this use case and can match or exceed large models on short text tasks
- **Asymmetric retrieval matters:** The memory summary is the "document" at index time; the query is a question or context at retrieval time. Models that support `input_type=document/query` distinction (all Voyage models, E5 models) benefit from this asymmetry
- **Voyage's input_type parameter:** All Voyage models prepend distinct prompts for queries vs documents. For memory retrieval, queries would use `input_type="query"` and stored summaries would use `input_type="document"`. This is a documented best practice.
- **Short text does not benefit from 32K context windows** — the context window advantage of voyage-3-large over competitors (Cohere 512, Gemini 2048) is irrelevant for 1-3 sentence memories

---

### 7. Anthropic's Stance and Partnership (as of March 2026)

Anthropic's official documentation (`docs.anthropic.com/en/docs/embeddings`) still recommends Voyage AI as their primary embedding partner. The documentation was verified March 2026 to show:

- "Anthropic does not offer its own embedding model"
- "One embeddings provider that has a wide variety of options and capabilities encompassing all of the above considerations is Voyage AI"
- Recommends: `voyage-3-large` (best quality), `voyage-3.5` (balanced), `voyage-3.5-lite` (lowest latency/cost)
- The documentation examples now default to `voyage-3.5` in code samples (not voyage-3-large)

**No announcement of any new Anthropic embedding partnership or their own embedding model** was found in research. The Voyage AI partnership appears stable and ongoing.

**Note:** The Anthropic docs have NOT been updated to reflect the voyage-4 family (January 2026). It is unclear whether this is a documentation lag or intentional.

Source: [Anthropic Embeddings docs](https://platform.claude.com/docs/en/docs/embeddings)

---

### 8. Voyage AI Pricing Summary (Confirmed March 2026)

| Model | Price/1M tokens | Free tier |
|-------|-----------------|-----------|
| voyage-4-large | ~$0.12 (unconfirmed) | 200M |
| voyage-3-large | $0.18 | 200M |
| voyage-3.5 / voyage-4 | $0.06 | 200M |
| voyage-3.5-lite / voyage-4-lite | $0.02 | 200M |
| voyage-context-3 | $0.18 | 200M |
| voyage-code-3 | $0.18 | 200M |

Source: [Voyage AI pricing docs](https://docs.voyageai.com/docs/pricing)

---

## Key Takeaways

1. **voyage-3-large is NOT the current state of the art** as of early 2026. Gemini Embedding-001 (July 2025) and the Voyage 4 family (January 2026) both claim to outperform it. However, voyage-3-large ($0.18/1M) remains Anthropic's documented recommendation.

2. **The Voyage 4 family (January 2026) is the likely best commercial choice** if quality is paramount. voyage-4-large claims +8.20% over Gemini Embedding-001. However, exact pricing for voyage-4-large is not yet confirmed, and independent MTEB leaderboard scores were not yet available at research time.

3. **voyage-3.5 at $0.06/1M is the cost-performance sweet spot** in the Voyage family — 3x cheaper than voyage-3-large with only ~2.5% lower nDCG accuracy. For short-text memory retrieval where the quality gap may be imperceptible in practice, this is worth considering.

4. **For the specific use case (1-3 sentence memory summaries):** The 32K context window advantage of voyage-3-large over Gemini (2048 tokens) is irrelevant. The $0.15/1M Gemini pricing is competitive with voyage-3-large's $0.18/1M. Gemini Embedding-001 is a legitimate alternative to evaluate.

5. **No open-source model on RTX 3070 (8GB VRAM) approaches voyage-3-large quality.** Qwen3-Embedding-0.6B is the best fit but likely 5-10% behind in retrieval quality. The Qwen3-Embedding-8B does reach #1 on MTEB but requires ~16GB VRAM.

6. **Cohere Embed v4 is multimodal but the text-only nDCG is below voyage-3-large** (MTEB 65.2 vs 66.8). Its 512-token context window is not a barrier for short text but reflects a different product focus.

7. **BEIR benchmark is fragmented.** Different sources report different scores because they use different BEIR subsets. The ailog BEIR 2.0 leaderboard only covers older Voyage models (voyage-large-2, not voyage-3-large). For voyage-3-large retrieval scores, agentset.ai (nDCG@10: 0.837) is the most reliable third-party source found.

---

## Gaps Identified

- **voyage-4-large exact pricing and independent MTEB scores** not yet publicly verified (model launched January 2026; MTEB submission may be pending)
- **Gemini Embedding-001 retrieval-specific nDCG@10 score** not found in isolation — only aggregate MTEB scores
- **Qwen3-Embedding-0.6B BEIR nDCG@10** not found in sources; only MTEB task-category scores
- **Direct BEIR comparison across all current-gen models** (voyage-3-large, Gemini, Qwen3-8B, voyage-4-large) on the same dataset set was not found
- **Jina v5 pricing** not found in official sources
- **voyage-4-large context window** not confirmed in public announcement

---

## Recommendations for Next Steps

1. **If choosing now:** voyage-3-large remains the Anthropic-recommended choice with confirmed benchmarks. voyage-3.5 at $0.06/1M is the cost-effective alternative with only 2.5% quality loss.

2. **Monitor voyage-4-large:** The voyage-4 family was released January 2026 and claims to outperform all competitors. Wait for independent MTEB leaderboard confirmation before committing to it.

3. **Evaluate Gemini Embedding-001 for this use case:** At $0.15/1M (17% cheaper than voyage-3-large), with higher aggregate MTEB score (68.32 vs 66.8), it is a serious alternative. The 2048-token context limit does not matter for 1-3 sentence summaries.

4. **Do not self-host for quality parity:** The RTX 3070 cannot run the Qwen3-Embedding-8B (the only open-source model that tops the MTEB leaderboard). All 8GB-VRAM-compatible models are meaningfully below voyage-3-large quality.

5. **For short-text memory retrieval specifically:** Run an offline evaluation with a sample of your actual agent memory summaries against voyage-3-large, voyage-3.5, and Gemini Embedding-001. The MTEB benchmarks are general; the quality gap may be smaller (or larger) for your specific data distribution.

---

## Sources

- [Anthropic Embeddings Docs](https://platform.claude.com/docs/en/docs/embeddings) — official Voyage AI recommendation, model table, March 2026
- [Voyage AI Pricing Docs](https://docs.voyageai.com/docs/pricing) — confirmed pricing for all Voyage models
- [Voyage 4 Announcement](https://blog.voyageai.com/2026/01/15/voyage-4/) — Voyage 4 MoE family, January 2026
- [voyage-3.5 Announcement](https://blog.voyageai.com/2025/05/20/voyage-3-5/) — voyage-3.5 specs and benchmarks, May 2025
- [voyage-3-large Announcement](https://blog.voyageai.com/2025/01/07/voyage-3-large/) — voyage-3-large specs and benchmarks, January 2025
- [Gemini Embedding Paper (arXiv:2503.07891)](https://arxiv.org/html/2503.07891v1) — MTEB scores, dimensions
- [Google Developers Blog — Gemini Embedding GA](https://developers.googleblog.com/gemini-embedding-available-gemini-api/) — general availability announcement
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) — $0.15/1M tokens
- [Qwen3 Embedding Blog](https://qwenlm.github.io/blog/qwen3-embedding/) — MTEB 70.58 (8B), dimensions, context window
- [Qwen3-Embedding-0.6B HuggingFace](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) — 0.6B model MTEB scores
- [Nomic Embed Text v2 MoE HuggingFace](https://huggingface.co/nomic-ai/nomic-embed-text-v2-moe) — BEIR 52.86, specs
- [Jina Embeddings v5 Paper (arXiv:2602.15547)](https://arxiv.org/html/2602.15547) — jina-v5-small MTEB 67.0
- [Cohere Embed v4 AWS Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-embed-v4.html) — specs
- [OpenAI Embeddings Docs](https://platform.openai.com/docs/models/text-embedding-3-large) — text-embedding-3-large specs
- [Ailog BEIR 2.0 Leaderboard](https://app.ailog.fr/en/blog/news/beir-benchmark-update) — BEIR nDCG@10 comparison table
- [Ailog Best Embedding Models 2025](https://app.ailog.fr/en/blog/guides/choosing-embedding-models) — aggregated MTEB scores
- [VentureBeat — Google takes #1 on MTEB](https://venturebeat.com/ai/new-embedding-model-leaderboard-shakeup-google-takes-1-while-alibabas-open-source-alternative-closes-gap) — Gemini leaderboard position
- Prior research: `AI_RESEARCH/2026-03-03-voyage-ai-embedding-benchmarks.md` — agentset.ai nDCG@10 scores for voyage family
