---
id: server-action-type-definitions
trigger: when writing a new server action function
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Server Action Type Definitions

## Action
Define named parameter type, result type, and branded function type for each server action export.

## Evidence
- Observed in 9+ server actions across two subsystems
- Task actions (session 4856ee0a): create-task.ts, delete-task.ts, list-tasks.ts, list-projects.ts, update-task.ts
- Project actions (session 4856ee0a): create-project.ts, update-project.ts, delete-project.ts
- Pattern: Every server action consistently exports with format `type ActionParams`, `type ActionResult`, `type Action` where function is annotated as `ActionType`
- Result types often use discriminated unions (e.g., `{ success: true } | { error: string }`) for mutations, direct object returns for reads
- Last observed: 2026-03-15T23:46:33Z

## Rationale
Type aliases enable IDE autocompletion, make intent explicit, and allow client code to reuse types without re-exporting from action files. The pattern provides consistency across the actions module.
