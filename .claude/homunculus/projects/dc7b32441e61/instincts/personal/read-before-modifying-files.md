---
id: read-before-modifying-files
trigger: when modifying or parsing configuration files and structured data files
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Always Read Files Before Modifying

## Action
Read file contents with the Read tool before using Edit or making decisions about file modifications.

## Evidence
- Observed 4 times in session 31a3b08a-b68a-4c42-8daf-343f83a59fb7
- Pattern: Read package.json → Edit package.json (providing originalFile context)
- Pattern: Read plugin package.json files before parsing dependencies
- Observed 5 times in session 4f4992b7-684f-4b35-9264-f6e40ea49329 (2026-03-18)
  - Read projects/page.tsx → Edit rewrite-with-ai.ts
  - Read create-agent-form.tsx → Write create-agent-form.tsx
  - Read create-project.ts → Bash verification
- Last observed: 2026-03-18T00:18:33Z

## Rationale
Ensures accurate understanding of current file state before making edits, prevents assumptions about file structure, and provides necessary context for the Edit tool (which requires prior Read).
