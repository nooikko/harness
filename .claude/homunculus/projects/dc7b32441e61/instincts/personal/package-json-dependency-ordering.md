---
id: package-json-dependency-ordering
trigger: when modifying package.json files or running lint checks on workspace dependencies
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Package.json Dependency Alphabetical Ordering

## Action
Always ensure `dependencies` and `devDependencies` keys in package.json files are sorted alphabetically; run `pnpm install --fix-unordered-dependencies` when violations are found.

## Evidence
- Observed 3+ times in session 16b14e12-934d-49dc-a7a7-9a36e7b3e990
- Pattern: npm-check-updates tool flags unordered-dependencies violations in multiple package.json files
- Affected files: @harness/plugin-ssh package.json, apps/web package.json
- Timestamps: 2026-03-20T17:36:51Z (ssh plugin), 2026-03-20T17:37:03Z (web app), 2026-03-20T17:37:19Z (fix applied)
- Auto-fixable with pnpm install flag; causes pre-commit hook failures if not addressed
- Last observed: 2026-03-20T17:37:19Z
