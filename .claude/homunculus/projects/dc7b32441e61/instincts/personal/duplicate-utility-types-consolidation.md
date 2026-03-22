---
id: duplicate-utility-types-consolidation
trigger: when discovering the same utility type (e.g. ProjectOption) defined across multiple component files
confidence: 0.85
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Consolidate Duplicate Utility Types

## Action
When the same utility type appears in 3+ component files, consolidate to a single shared types file (e.g. `_types.ts`) and import from there instead of redefining.

## Evidence
- Observed 4 times in session 970f6bb0-139e-4fbc-81a1-cfb02bb4e5a1
- Pattern: ProjectOption type defined identically in:
  - manage-thread-modal.tsx (line 25)
  - nav-chats.tsx (line 8)
  - thread-header.tsx (line 8)
  - thread-list-item.tsx (line 10)
- Each defines: `type ProjectOption = { id: string; name: string }`
- Last observed: 2026-03-13T23:00:40Z

## Why
Duplicated types across components create maintenance burden when contracts change. A single source of truth ensures consistency and reduces likelihood of divergent definitions creeping in during future modifications.
