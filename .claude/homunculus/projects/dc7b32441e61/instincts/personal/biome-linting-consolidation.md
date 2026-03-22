---
id: biome-linting-consolidation
trigger: when refactoring linting configuration across package.json, turbo.json, and lint-staged config
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Biome Linting Consolidation

## Action
When consolidating linting tooling, migrate from turbo-based lint tasks to direct biome invocation: update package.json lint script to use `biome check .`, remove lint task from turbo.json, and ensure .lintstagedrc.json uses biome.

## Evidence
- Observed 3 times in session fb82d648-d365-4942-974d-2a480cdd8639 on 2026-03-17
- Pattern: Multiple file edits working together to consolidate linting
- Edit 1 (17:42:13Z): package.json - changed `"lint": "turbo lint"` to `"lint": "biome check ."`
- Edit 2 (17:42:14Z): turbo.json - removed `"lint": {}` task definition
- Read (17:42:02Z): `.lintstagedrc.json` already using biome: `"biome check --write --no-errors-on-unmatched"`
- Rationale: Direct biome invocation removes unnecessary turbo wrapper layer for linting
- Last observed: 2026-03-17T17:42:14Z

## Context
The harness project uses biome as its code formatter and linter. This pattern indicates a preference for calling biome directly from npm scripts rather than routing through turbo's task runner, simplifying the linting pipeline.
