---
id: webfetch-sequential-research-deep-dive
trigger: when starting investigation of a new library, framework, or integration
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# WebFetch Sequential Research Deep Dive

## Action
When investigating a new integration (Qdrant, embedding models, Node.js client libraries), fetch multiple pages sequentially across official documentation to build comprehensive technical understanding before writing code. Don't stop after one page — systematically follow the conceptual chain: intro → API reference → implementation patterns → code examples.

## Evidence
- Session 2026-03-15 06:33-06:34: 13+ WebFetch calls across qdrant.tech and huggingface.co
- Pattern: quickstart (06:33:55) → interfaces (06:34:05) → concepts/points (06:34:24, 06:34:35) → implementation examples (06:34:26, 06:34:35, 06:34:37, 06:34:47)
- Result: Comprehensive Qdrant JS Client API knowledge (constructor params, collections, upsert, query, delete) plus embedding model evaluation (dimensions, node.js compatibility)
- No code written until documentation comprehension established; research file created at end (06:35:52)
- Session 49317fb5 (2026-03-18 00:22-00:23): 7+ WebFetch calls on character/persona research across Anthropic docs, Character.ai docs, arxiv papers, GitHub references
- Pattern: Anthropic Claude character traits → Character.ai definition fields → PsyPlay personality injection framework → Role Identity Activation research → Awesome LLM role-playing repo
- Result: Systematic understanding of character definition approaches (direct traits, experience narratives, consistency mechanisms, benchmark frameworks)

## Trigger Specificity
- New external library or service integration
- Evaluating multiple options (Voyage AI vs. Xenova vs. Ollama)
- Building understanding of unfamiliar API surface before implementation
- NOT applicable to small tweaks or bug fixes in known code

## Context
Distinguished from simple "prefer official docs" — this is about building a comprehensive knowledge map through systematic sequential reads rather than quick point lookups. Particularly valuable for infrastructure/integration work where architectural decisions depend on full API understanding.
