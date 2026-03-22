---
id: prompt-assembly-pipeline-exploration
trigger: when investigating how prompts are constructed through plugin layers (assembler → identity → context → time)
confidence: 0.85
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Prompt Assembly Pipeline Exploration

## Action
When understanding prompt construction, sequentially explore the complete pipeline: assembler entry point → identity plugin (header, anchor, bootstrap) → context plugin (history, files, project) → time plugin, tracing data injection at each layer.

## Evidence
- Observed 12+ file reads across session 55ffe247
- Pattern: Sequential exploration of prompt composition layers:
  1. `orchestrator/index.ts` — pipeline entry
  2. `prompt-assembler.ts` — base prompt template
  3. `identity/_helpers/format-identity-header.ts` — agent identity injection
  4. `identity/_helpers/format-identity-anchor.ts` — behavioral anchor
  5. `identity/_helpers/format-bootstrap-prompt.ts` — first-time setup
  6. `context/index.ts` — history/files/project context injection
  7. `context/_helpers/load-file-references.ts` — file scoping logic
  8. `context/_helpers/format-file-references.ts` — file formatting
  9. `context/_helpers/format-history-section.ts` — history formatting
  10. `context/_helpers/format-user-profile-section.ts` — user profile formatting
  11. `time/index.ts` — time injection
- Last observed: 2026-03-14T06:25:34Z

## When to Apply
When auditing, understanding, or modifying:
- Prompt scope boundaries (agent/thread/project/global)
- Data injection order and precedence
- Plugin hook execution sequence
- Memory hierarchy in prompts
- File reference scoping logic

## Key Insight
The pipeline follows a consistent pattern: read orchestrator entry → read assembler base → read each plugin's register function → read plugin helpers in order of injection. This reveals where scope boundaries are enforced or violated.
