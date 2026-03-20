---
id: read-grep-read-workflow
trigger: when reading a file reveals need to find related files
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Read-Grep-Read Workflow Pattern

## Action
After reading an initial file, use bash grep to find related files by searching for imports or references, then read those files to understand the full context.

## Evidence
- Observed 3+ times in session 2464ac8f-58a5-496a-b12e-600dcb754571
- Observed 6+ times in session 4856ee0a-a85e-44ce-988d-133f25f77051 (latest sequence: Bash grep → Agent explore → Read 3x component files)
- Pattern: read file → grep for related files (e.g., searching for sidebar imports, project references) → read found files
- Example: read UI index.ts → grep for component usages → read component files
- Current pattern: Bash grep for data model flow (durationMs, toolUseId) → Agent delegation for deep context → Read tool-call-block.tsx, collapsible-block.tsx, tool-result-block.tsx
- Last observed: 2026-03-17T00:33:13Z

## Context
This workflow appears when understanding interconnected systems. Reading an initial file creates questions about where it's used or what uses it; grep answers those questions by revealing relationship patterns before deeper investigation.
