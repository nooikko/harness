---
id: sequential-todo-completion
trigger: when you have multiple pending tasks in TodoWrite
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Complete One Task Before Starting the Next

## Action
Mark only one task as in_progress at a time. Complete it fully, update TodoWrite to mark it completed, then move the next task to in_progress.

## Evidence
- Observed 3+ times consistently in session 20d108a3-0403-439c-abbd-0bfb5dd49a29
- Pattern: Task state transitions show never more than one task in in_progress status at any time
  - agent-definitions: pending → in_progress → completed
  - project-definitions: pending → in_progress → completed
  - cron-job-definitions: pending → in_progress → completed
  - seed refactoring: pending → in_progress (next)
- Last observed: 2026-03-18T00:38:13Z

## Why
Maintains clear focus, prevents context switching, ensures each task is fully resolved before moving on, and keeps TodoWrite accurate as a progress indicator.
