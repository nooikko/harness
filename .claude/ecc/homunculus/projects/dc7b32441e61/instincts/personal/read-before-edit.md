---
id: read-before-edit
trigger: when preparing to modify a file with the Edit tool
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Always Read File Before Editing

## Action
Read the entire file using the Read tool before using the Edit tool to modify it, ensuring awareness of context and current content.

## Evidence
- Observed 4 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Every file modification was preceded by a Read of the target file
  - generate-plugin-registry.ts (Read 22:03:41 → Edit 22:03:46)
  - cast-device-list.tsx (Read 22:07:34 → Edit 22:07:46)
  - cast-device-list.tsx (Read 22:07:34 → Edit 22:08:00)
  - music/page.tsx (Read 22:08:13 → Edit 22:08:32)
- Last observed: 2026-03-16T22:08:32Z
