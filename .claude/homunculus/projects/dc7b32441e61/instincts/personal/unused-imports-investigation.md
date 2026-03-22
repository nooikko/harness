---
id: unused-imports-investigation
trigger: when biome lint reports noUnusedImports errors across test or plugin files
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Unused Imports Investigation Workflow

## Action
When biome detects unused imports, verify actual usage with Grep searches across the codebase before removing them, as test files and mocked contexts may have false positives.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: biome reports unused imports → multiple Grep searches to check usage → fixes applied → "All lint clean" result
- Specific errors: noUnusedImports in test files show imports like PluginContext, vitest utilities
- Grep searches (7+ sequential calls) investigating import usage across the codebase
- Last observed: 2026-03-16 07:23:27Z

## Context
The harness project uses Biome for linting with monorepo structure (@harness/plugin-music, @harness/oauth, etc.). Test files with mocked contexts frequently trigger false positives for unused imports because mocks may use types indirectly or for type safety.
