---
name: harness-research-workflow
description: Research-first workflow for technical investigations — fetch official docs, explore sequentially, handle empty responses
evolved_from:
  - webfetch-official-docs-pattern
  - webfetch-sequential-research-deep-dive
  - async-research-investigation-pattern
  - monorepo-package-research-prelude
  - webfetch-empty-response-fallback
---

# Harness Research Workflow

Auto-triggered when investigating technical unknowns before implementation.

## Patterns

### Official Docs First
- Always fetch official documentation before Stack Overflow or blog posts
- Use WebFetch on the library's docs URL, not WebSearch
- If WebFetch returns empty, try the raw GitHub README or API reference

### Sequential Deep Dive
- Start broad: library homepage / getting started
- Then narrow: specific API / config option
- Then verify: changelog / migration guide for version compatibility
- Save findings to `AI_RESEARCH/YYYY-MM-DD-<topic>.md`

### Empty Response Fallback
- WebFetch sometimes returns empty string on successful HTTP 200
- Fallback chain: WebFetch → WebSearch → context7 MCP → manual exploration
- Never assume a feature doesn't exist because one source returned nothing

### Monorepo Package Decisions
- Before creating a new `packages/` entry, research:
  1. Does an existing package already cover this?
  2. What are the workspace dependency implications?
  3. Will multiple apps consume it, or just one?
- If only one consumer, co-locate instead of creating a package

### Research Documentation
- Timestamped files in `AI_RESEARCH/` directory
- Format: `YYYY-MM-DD-<descriptive-kebab-case>.md`
- Include: sources consulted, key findings, decision rationale
