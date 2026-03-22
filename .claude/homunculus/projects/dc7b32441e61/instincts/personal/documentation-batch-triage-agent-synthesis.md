---
id: documentation-batch-triage-agent-synthesis
trigger: when reviewing a batch of related documentation/research files for consolidation and KEEP/DELETE/CONSOLIDATE decisions
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Documentation Batch Triage with Agent Synthesis

## Action
When triaging a batch of related documentation files, use an Agent to read and synthesize all files together, capture the structured summary, then mark KEEP/DELETE/CONSOLIDATE decisions in the tracking plan document.

## Evidence
- Observed 2+ batches across sessions (previous session: Batch 1 with 10 files; current session: Batch 2 with 4 files)
- Pattern: Read files → Agent call to analyze all together → capture synthesis output → update plan document with [x] checkboxes and KEEP/DELETE/CONSOLIDATE annotations
- Session 2026-03-17 10:52-12:17: "Batch 1: Agent Identity, Memory, Bootstrap (10 files) — REVIEWED, 3 DELETE / 7 KEEP"
- Session 2026-03-17 continuing: Batch 2 processing with same workflow (Agent analyzed 6 workspace-isolation files, decisions being marked)
- Last observed: 2026-03-17T19:20:08Z

## When to Apply
When managing documentation consolidation or memory cleanup with multiple files per topic:
- Read a batch of related files (typically 4-10 files with topical overlap)
- Launch Agent with `subagent_type: Explore` or general-purpose to analyze all files together
- Request a structured summary identifying overlap, redundancy, and unique value per file
- Use the summary to annotate the plan document with KEEP/DELETE/CONSOLIDATE decisions
- Mark decisions with [x] checkbox notation and clear reasoning

## Benefits
- Agent synthesis catches overlap and redundancy humans might miss
- Structured decision format is audit-able and repeatable across batches
- Prevents deletion of files with unique value by forcing explicit analysis
- Enables resumable multi-batch workflows (batch 1 → batch 2 → batch 3, etc.)
