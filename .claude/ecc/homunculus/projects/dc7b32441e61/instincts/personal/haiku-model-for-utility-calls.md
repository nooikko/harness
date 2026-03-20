---
id: haiku-model-for-utility-calls
trigger: when invoking LLM for lightweight operations like scoring, summarization, or extraction
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Haiku Model for Utility LLM Calls

## Action
Use `claude-haiku-4-5-20251001` specifically for lightweight, cost-effective operations (importance scoring, content summarization, memory classification, thread extraction) rather than the primary agent model.

## Evidence
- Observed 3+ times in session observations from harness plugin ecosystem
- Pattern: Utility operations consistently prefer haiku over heavier models
  - `score-and-write-memory.ts`: Haiku for importance scoring and summary generation
  - `audit/index.ts`: Haiku for thread conversation extraction
- Rationale: Cost optimization for secondary/supporting LLM calls that don't require reasoning complexity

## Context
The harness uses this pattern to keep token costs down for asynchronous background operations that support the primary agent pipeline. Memory operations, audits, and metadata extraction don't need the full reasoning capacity of primary models.

## When to Apply
- Scoring or rating operations (e.g., importance 1-10)
- Content summarization/condensation
- Classification or tagging
- Extraction from structured/unstructured text
- Any operation that produces metadata about primary agent output

**Do NOT use for**: Core agent reasoning, delegation decisions, or complex multi-step tasks
