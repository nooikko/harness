---
id: biome-use-block-statements-pattern
trigger: when writing conditional returns or early exits
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Biome useBlockStatements Style Pattern

## Action
Always use block statements for single-line conditionals; don't use shorthand `if (!x) return;` format.

## Evidence
- Observed 13 times across multiple files in March 2026
- Pattern: Biome lint flags single-line conditionals as violating useBlockStatements rule
- Affected files: project-chat-input.tsx, project-files-panel.tsx (multiple violations), format-relative-time.ts (4 violations)
- Additional session 4856ee0a observations: 22:44:45 biome check found 9 errors, 22:44:54 detailed output shows useBlockStatements violations
- All violations consistently fixable with Edit tool replacement
- Last observed: 2026-03-15T22:44:54Z
