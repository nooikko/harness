---
id: write-tool-comprehensive-plans
trigger: when planning multiple features or systems for the project, use Write tool to create full plan documents in .claude/plan/ directory
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Write Tool for Comprehensive Plans

## Action
Create full plan documents in one Write call to `.claude/plan/` directory instead of incremental edits or split files.

## Evidence
- Observed 9 consecutive plan creations in session 2464ac8f (2026-03-14)
- Pattern: user writes complete feature plans (Microsoft Graph, File Uploads, Rich Response, Project Area, Search Bar, Cron/Calendar, Morning News, Agent Malleable) as single comprehensive documents via Write tool
- Directory convention: `.claude/plan/<kebab-case-description>.md`
- Each plan includes: Summary, Design Decisions, Architecture/Schema, Implementation Steps sections
- Last observed: 2026-03-14T09:25:36Z

## Why
Planning documents need to be complete and self-contained for autonomous agent execution (PodCode handoff). Write tool enforces full document creation upfront; incremental edits fragment context and delay finalization.
