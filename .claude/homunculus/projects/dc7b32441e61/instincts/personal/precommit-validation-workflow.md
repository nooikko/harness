---
id: precommit-validation-workflow
trigger: when preparing commits or running validation checks
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Pre-commit validation with typecheck and biome

## Action
The project validates code before commits using `npm run typecheck` (TypeScript type checking) and `biome check --write` (formatting/linting) via lint-staged hooks.

## Evidence
- Observed 4 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Workflow includes sequential validation: tsc --noEmit → biome check → lint-staged with biome --write → sherif linting
- TypeScript issues must be resolved before commits (tsc --noEmit with no-emit flag for validation only)
- Code formatting is applied automatically via lint-staged pre-commit hook
- Last observed: 2026-03-16T22:14:41Z (commit with "Checked 13 files in 21ms. Fixed 2 files.")
