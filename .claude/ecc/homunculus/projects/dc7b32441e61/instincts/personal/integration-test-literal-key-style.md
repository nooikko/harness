---
id: integration-test-literal-key-style
trigger: when biome lints integration test files and reports useLiteralKeys FIXABLE violations
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Integration Test Literal Key Style

## Action
Run `npm run check` to auto-fix useLiteralKeys violations in test files (biome check --write), or standardize test setup objects to use dot notation for known property access instead of bracket notation.

## Evidence
- Observed 5 times in single session on 2026-03-17
- Pattern: Integration test files across multiple plugins use bracket notation (`["key"]`) for accessing known object properties instead of dot notation (`.key`)
- Affected test files: calendar-plugin.test.ts (line 15), music-plugin.test.ts (line 65), outlook-plugin.test.ts (line 13), search-plugin.test.ts (line 24), tasks-plugin.test.ts (line 9)
- All violations: biome rule `lint/complexity/useLiteralKeys` marked FIXABLE
- Consistent pattern: test setup objects with bracket-style property access
- Last observed: 2026-03-17T17:44:25Z

## Context
The project has separate npm scripts for linting:
- `lint`: runs `biome check .` (check-only, used in CI)
- `check`: runs `biome check --write .` (auto-fixes, used locally)

These violations are auto-fixable but persist, suggesting test setup code hasn't been auto-fixed yet.
