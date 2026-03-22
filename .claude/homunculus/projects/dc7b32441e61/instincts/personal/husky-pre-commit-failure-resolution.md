---
id: husky-pre-commit-failure-resolution
trigger: when pre-commit hooks fail with linting, security, or dependency errors during git operations
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Husky Pre-commit Hook Failure Resolution

## Action
When `husky - pre-commit script failed (code 1)` occurs, resolve the underlying validation errors (biome formatting, unordered dependencies, or security leaks) before attempting to commit; tools like `biome check --write`, `pnpm install --fix-unordered-dependencies`, or `sherif` provide automated fixes.

## Evidence
- Observed 3+ times in session 16b14e12-934d-49dc-a7a7-9a36e7b3e990
- Pattern: Multiple validation layers trigger pre-commit failures in sequence
- Failure points:
  - 2026-03-20T17:36:03Z: biome found 8 errors causing husky failure
  - 2026-03-20T17:36:51Z: npm-check-updates found unordered dependencies causing husky failure
  - 2026-03-20T17:37:56Z: sherif found 4 security leaks causing husky failure
- All failures prevented commit and required running validation tooling with fix flags
- Last observed: 2026-03-20T17:37:56Z
