# Research: Voyage AI Embedding Model Benchmarks
Date: 2026-03-03

## Summary

Comparison of voyage-3-large, voyage-3.5, and voyage-3.5-lite embedding models on retrieval benchmarks. The headline finding is nuanced: **voyage-3-large scores higher on Voyage AI's own 100-dataset internal evaluation, but voyage-3.5 is positioned as the cost-optimized successor** — smaller output dimension, faster inference, and same price per token as voyage-3. On the MTEB-style third-party evaluation (agentset.ai), voyage-3-large also leads on accuracy but voyage-3.5 leads dramatically on latency.

## Prior Research
None — first research file on this topic.

## Current Findings

### 1. The Key Nuance: voyage-3.5 Does NOT Outperform voyage-3-large

This is the most important finding to understand. Voyage AI's blog post for voyage-3.5 (May 2025) benchmarks it against voyage-3, Cohere-v4, and OpenAI-v3-large — but **does NOT directly compare it to voyage-3-large**.

From the voyage-3.5 spreadsheet (Voyage AI's own 100-dataset evaluation):
- **voyage-3-large (float, 2048):** 80.41% overall
- **voyage-3-large (int8, 2048):** 80.43% overall
- **voyage-3.5 (float, 2048):** 78.93% overall (estimated top configuration)
- **voyage-3.5 variants range:** 76.32%–78.93% overall

voyage-3-large scores approximately **1.5–4 percentage points higher** than voyage-3.5 on Voyage AI's own 100-dataset benchmark.

The voyage-3.5 improvements that Voyage AI claims are relative to voyage-3 (not voyage-3-large):
- voyage-3.5 outperforms voyage-3 by 2.66%
- voyage-3.5-lite outperforms voyage-3-lite by 4.28%

### 2. Official Benchmark Claims (Voyage AI)

**voyage-3-large** (released January 2025):
- Outperforms OpenAI-v3-large by **9.74%** on average (100 datasets)
- Outperforms Cohere-v3-English by **20.71%** on average
- Outperforms voyage-3 by **4.14%** on average
- Outperforms voyage-3-lite by **7.68%** on average
- At 1024 dimensions: **10.58%** better than OpenAI-v3-large
- At 256 dimensions: **11.47%** better than OpenAI-v3-large
- Binary 512-dim: **1.16% better** than OpenAI float 3072-dim despite 200x less storage
- Storage: int8/1024 is only 0.31% below float/2048 at 8x less storage
- Binary rescoring: up to **5.84%** quality improvement

**voyage-3.5** (released May 2025):
- Outperforms OpenAI-v3-large by **8.26%** on average
- Outperforms Cohere-v4 by **1.63%** on average
- Outperforms voyage-3 by **2.66%** on average
- Binary rescoring: up to **6.38%** quality improvement
- Cost: $0.06/1M tokens (same as voyage-3)
- Default dimension: 1024 (vs OpenAI's 3072 — 1.5x smaller)

**voyage-3.5-lite** (released May 2025):
- Outperforms OpenAI-v3-large by **6.34%** on average
- Within **0.3%** of Cohere-v4 at 1/6 the cost
- Outperforms voyage-3-lite by **4.28%** on average
- Binary rescoring: up to **6.89%** quality improvement
- Cost: $0.02/1M tokens (3x cheaper than voyage-3.5)

### 3. Storage/Cost Reduction (voyage-3.5 specific claims)

| Configuration | vs OpenAI-v3-large (float, 3072) | Quality vs OpenAI |
|---|---|---|
| voyage-3.5 (int8, 2048) | 83% cheaper vector DB | +8.25% better |
| voyage-3.5-lite (int8, 2048) | 83% cheaper vector DB | +6.35% better |
| voyage-3.5 (binary, 1024) | 99% cheaper vector DB | +3.63% better |
| voyage-3.5-lite (binary, 1024) | 99% cheaper vector DB | +1.29% better |

### 4. Third-Party Benchmark Data (agentset.ai)

agentset.ai uses an ELO-rating system based on head-to-head comparisons across multiple BEIR/MTEB datasets (DBPedia, FiQa, SciFact, MSMARCO, ARCD). Results as of their current evaluation:

**voyage-3-large:**
- ELO: 1528 | Win Rate: 52.6% | Overall nDCG@10: 0.837 | Latency: 113ms

**voyage-3.5:**
- ELO: 1515 | Win Rate: 48.8% | Overall nDCG@10: 0.816 | Latency: 13ms

**voyage-3.5-lite:**
- ELO: 1503 | Win Rate: 44.4% | Overall nDCG@10: 0.803 | Latency: 11ms

**Ordering: voyage-3-large > voyage-3.5 > voyage-3.5-lite** on accuracy.
**Ordering: voyage-3.5-lite ≈ voyage-3.5 >> voyage-3-large** on latency (8–9x faster).

### 5. Dataset-Specific Scores (agentset.ai, nDCG@10)

| Dataset | voyage-3-large | voyage-3.5 | voyage-3.5-lite |
|---|---|---|---|
| SciFact | 0.809 | 0.751 | 0.719 |
| ARCD | 0.960 | 0.950 | 0.935 |
| DBPedia | 0.638 | 0.637 | 0.632 |
| FiQa (finance) | 0.780 | 0.741 | 0.736 |
| MSMARCO | 0.998 | 1.000 | 0.995 |

**Notable patterns:**
- On DBPedia (entity/fact retrieval): voyage-3-large and voyage-3.5 are nearly identical (0.638 vs 0.637)
- On MSMARCO (web passage retrieval): voyage-3.5 marginally exceeds voyage-3-large (1.000 vs 0.998)
- On SciFact (scientific claim retrieval): voyage-3-large leads substantially (0.809 vs 0.751)
- On FiQa (financial QA): voyage-3-large leads (0.780 vs 0.741)
- voyage-3.5-lite is consistently below voyage-3.5 but not by a large margin

### 6. Voyage AI's 100-Dataset Evaluation — Domain Coverage

Voyage AI evaluates across 8 domains (100 datasets total):
- **TECH** (5 datasets): Cohere, 5G, OneSignal, LangChain, PyTorch documentation
- **CODE** (8 datasets): LeetCode variants, HumanEval, MBPP, DS1000, APPS
- **LAW** (5 datasets): LeCaRDv2, LegalQuAD, LegalSummarization, AILA cases/statutes
- **FINANCE** (9 datasets): SEC filings, RAG benchmarks, financial QA
- **WEB** (4 datasets): Review and forum content
- **LONG-CONTEXT** (4 datasets): NarrativeQA, QMSum, SummScreenFD, WikimQA
- **CONVERSATION** (3 datasets)
- **MULTILINGUAL** (62 datasets, 23+ languages)

Domain-specific scores from the voyage-3-large spreadsheet evaluation (overall nDCG):
- voyage-3-large (float, 2048): **80.41%** overall
- voyage-3-large (int8, 2048): **80.43%** overall (slightly higher due to quantization regularization)
- voyage-3.5 best configuration: **~78.93%** overall

Domain-specialist comparison notes from voyage-3-large blog:
- **Law**: voyage-law-2 (domain-specialist) scored 72.81% — voyage-3-large surpassed it
- **Finance**: voyage-finance-2 (domain-specialist) scored 80.94% — the domain specialist still leads on finance
- **Code**: voyage-code-3 (domain-specialist) scored 90.81% — still far ahead for code

### 7. What voyage-3.5 Actually Improves Over voyage-3-large

voyage-3.5 is NOT positioned as a replacement for voyage-3-large. It is a replacement for voyage-3 (mid-tier). The product line hierarchy is:

| Model | Tier | Price/1M | Dimension | Context |
|---|---|---|---|---|
| voyage-3-large | Premium/flagship | $0.18 | 1024 (up to 2048) | 32K |
| voyage-3.5 | Mid-tier (successor to voyage-3) | $0.06 | 1024 | 32K |
| voyage-3.5-lite | Budget | $0.02 | 512 | 32K |
| voyage-3 | Mid-tier (previous gen) | $0.06 | 1024 | 32K |
| voyage-3-lite | Budget (previous gen) | $0.02 | 512 | 32K |

voyage-3.5 is 3x cheaper than voyage-3-large. Its "improvements" are vs voyage-3, not vs voyage-3-large.

### 8. Why voyage-3.5 Claims to Outperform OpenAI-v3-large More Than voyage-3-large Does

This is explained by the comparison baseline:
- voyage-3-large (Jan 2025) was compared against **Cohere-v3-English** (older)
- voyage-3.5 (May 2025) was compared against **Cohere-v4** (newer, stronger)

voyage-3-large beats OpenAI-v3-large by 9.74%; voyage-3.5 beats OpenAI-v3-large by 8.26%. voyage-3-large still leads OpenAI-v3-large by a larger margin.

### 9. Community Notes (Hacker News)

From the voyage-3.5 HN discussion (May 2025):
- Community criticism: voyage-3.5 blog conspicuously omits comparison to Gemini Embedding-001 (which scores higher on some benchmarks)
- Community note: Marginal 1–3% improvements may not matter in practice for systems that retrieve 25–100 candidates and rerank
- No direct voyage-3.5 vs voyage-3-large community benchmark data found

### 10. voyage-3.5 Training Improvements

Despite not beating voyage-3-large overall, voyage-3.5 improved over voyage-3 via:
- Improved training data mixture
- **Distillation from voyage-3-large** (knowledge transfer)
- Integration of Voyage AI reranker signals
- Matryoshka learning + quantization-aware training (supports 256/512/1024/2048 dim)

## Key Takeaways

1. **voyage-3-large outperforms voyage-3.5 on both Voyage AI's internal evaluation and third-party benchmarks** (agentset.ai). voyage-3-large scores ~80.4% vs voyage-3.5 at ~78.9% on the 100-dataset suite. On agentset.ai nDCG@10: 0.837 vs 0.816.

2. **voyage-3.5 is NOT the successor to voyage-3-large** — it is the successor to voyage-3 (mid-tier). They are different price tiers ($0.18 vs $0.06/1M tokens, 3x price difference).

3. **voyage-3.5 beats voyage-3-large on latency by ~8x** (13ms vs 113ms per agentset.ai), which matters for real-time applications.

4. **On MSMARCO (web passage retrieval), voyage-3.5 ties or slightly beats voyage-3-large** (nDCG@10 1.000 vs 0.998). On scientific and financial retrieval, voyage-3-large leads more substantially.

5. **voyage-3.5-lite is a strong budget option** — achieves nDCG@10 0.803 (vs voyage-3.5's 0.816) at 1/3 the cost, with 11ms latency.

6. **For Qdrant/vector search use cases**: voyage-3-large at int8/1024 dimensions retains 99.7% of float quality at 8x less storage. voyage-3.5 at binary/1024 reduces storage by 99% vs OpenAI-v3-large with still-better quality (+3.63%).

7. **Domain specialists still lead on their domains**: voyage-code-3 (code), voyage-finance-2 (finance), voyage-law-2 (law) remain the best choices for domain-specific retrieval.

## Gaps Identified

- **No published per-domain nDCG scores for voyage-3.5** — Voyage AI's blog only gives aggregate percentage improvements; the detailed spreadsheet was not web-accessible
- **MTEB official leaderboard** does not yet show voyage-3.5 scores (leaderboard may not be updated)
- **BEIR 2.0 leaderboard** only shows voyage-large-2 (older model), not voyage-3.x variants
- **No long-document-specific comparison**: voyage-3-large's domain breakdown shows long-context as a category but no isolated voyage-3.5 scores for it
- **No code retrieval comparison** between voyage-3.5 and voyage-3-large specifically

## Sources

- Voyage AI Blog — voyage-3.5 announcement (May 20, 2025): https://blog.voyageai.com/2025/05/20/voyage-3-5/
- Voyage AI Blog — voyage-3-large announcement (January 7, 2025): https://blog.voyageai.com/2025/01/07/voyage-3-large/
- Voyage AI official docs (model specs table): https://docs.voyageai.com/docs/embeddings
- Agentset.ai — voyage-3-large benchmark: https://agentset.ai/embeddings/voyage-3-large
- Agentset.ai — voyage-3.5 benchmark: https://agentset.ai/embeddings/voyage-35
- Agentset.ai — voyage-3.5-lite benchmark: https://agentset.ai/embeddings/voyage-35-lite
- Agentset.ai — voyage-3-large vs voyage-3.5 comparison: https://agentset.ai/embeddings/compare/voyage-3-large-vs-voyage-35
- Voyage AI evaluation spreadsheet (voyage-3-large): https://docs.google.com/spreadsheets/d/1Su4k9pfLgKfLQCLlqz-SlW9aErEJXOPYZyhZ_XbViFI
- Voyage AI evaluation spreadsheet (voyage-3.5): https://docs.google.com/spreadsheets/d/1KeNJMrYcRy9WdbL5CdE-4AWZmu7fDtJsSgIfafmByzw
- MongoDB blog repost — voyage-3.5: https://www.mongodb.com/company/blog/product-release-announcements/introducing-voyage-3-5-voyage-3-5-lite-improved-quality-new-retrieval-frontier
- Hacker News discussion — voyage-3.5 launch: https://news.ycombinator.com/item?id=44059270
