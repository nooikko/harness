---
id: typecheck-after-component-write
trigger: when writing new web components or editing imports
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Typecheck Immediately After Component File Writes

## Action
After writing or editing component files, immediately run `pnpm typecheck` to catch missing imports, incorrect module paths, and type errors before they accumulate.

## Evidence
- Observed 3 times in session c4b88b9a, 4856ee0a, 24439914 on 2026-03-15
- Pattern: Write component file → Bash typecheck within 1-3 operations
  - 06:18:49 Edit top-bar.tsx → 06:18:46 Bash typecheck
  - 06:19:06 Write task files → 06:19:06 Bash typecheck (catches missing imports)
  - 06:19:23+ Multiple writes → 06:19:29 Bash typecheck (validates setup)
- Errors caught: Missing modules ('ui' vs '@harness/ui'), undefined component imports
- Last observed: 2026-03-15T06:19:29Z

## Context
This workflow prevents import path mismatches in monorepo structure. When components use shorthand imports ('ui' instead of '@harness/ui'), typecheck reveals the issue immediately, enabling quick grep-based pattern discovery and fix cycles.
