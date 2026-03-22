---
id: read-before-edit-workflow
trigger: when modifying configuration files like package.json
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Read Before Edit Workflow

## Action
Always read a file first before making edits to it, even if you know the specific section that needs changing.

## Evidence
- Observed 3 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: oauth/package.json read then edit zod version; orchestrator/package.json read then edit dependency order (twice)
- Last observed: 2026-03-16T07:25:54Z

## Rationale
This ensures you have the complete current state before making changes and catch any unexpected file structure or recent modifications. Particularly important for configuration files that may have been modified since your last interaction.
