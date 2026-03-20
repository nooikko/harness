---
id: multi-plugin-package-inventory
trigger: when auditing or inventorying the plugin ecosystem metadata
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Multi-Plugin Package Inventory Audit

## Action
Systematically read package.json from each plugin in sequence to snapshot versions, dependencies, and configuration state.

## Evidence
- Observed 15+ sequential package.json reads in session 9fc9b500-3fe7-4994-9892-df5e7e684625
- Pattern: plugins audited in order: web, delegation, discord, context, audit, validator, metrics, time, project, summarization, auto-namer, music, plugin-contract, plus tsconfig/vitest configs
- Includes supplementary config file reads (tsconfig.json, vitest.config.ts) and bash filesystem inventory
- Last observed: 2026-03-14T06:25:13Z
- Context: Understanding plugin ecosystem structure, versions, and dependencies

## When to Use
Before:
- Making changes that affect multiple plugins
- Assessing plugin ecosystem health/versions
- Planning cross-plugin refactors
- Understanding current dependency state

## Pattern Details
Typical workflow:
1. Use bash to list plugins: `ls packages/plugins`
2. Systematically read each plugin's package.json
3. Note tsconfig/vitest configurations
4. Check main package.json for CLI orchestrator deps
