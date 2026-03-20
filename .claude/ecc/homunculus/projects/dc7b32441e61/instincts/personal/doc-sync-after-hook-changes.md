---
id: doc-sync-after-hook-changes
trigger: when updating plugin hook definitions or core orchestrator architecture
confidence: 0.7
domain: file-patterns
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Rapid Documentation Sync for Hook/Architecture Changes

## Action
When making changes to plugin hooks, orchestrator config, or hook runner utilities, update `docs/plugin-development.md` in rapid succession with multiple small edits rather than batching them.

## Evidence
- Observed 4 consecutive Edit calls to `docs/plugin-development.md` within 40 seconds (18:48:42–18:49:22 UTC on 2026-03-17)
- Changes reflected pattern of synchronizing hook documentation with code changes:
  - Replacing `onCommand` hook documentation with `onPipelineStart`/`onPipelineComplete`
  - Updating delegation plugin description from command-based to MCP tool-based
  - Adding `uploadDir` field to OrchestratorConfig documentation
  - Updating hook runner utilities count and hook list in docs
- Last observed: 2026-03-17 18:49:22

## Context
This pattern suggests that documentation updates to the plugin development guide happen incrementally as the architecture changes, with multiple iterations to keep code and docs in sync during active architectural work on the orchestrator.
