---
id: progressive-task-refinement-during-refactoring
trigger: when performing multi-step refactoring, migration, or large-scope UI consolidation work
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Progressive Task Refinement During Refactoring

## Action
Use TodoWrite repeatedly throughout large refactoring work to progressively add new subtasks, refine task descriptions with more detail, and split tasks as the full scope becomes clearer.

## Evidence
- Observed 5 times in session 6e9704b0-18b6-484f-843e-12f408b93468 (2026-03-19 06:20:01 to 06:29:33)
- Pattern: Each TodoWrite call adds newly discovered subtasks (e.g., "Add .claude/rules/ui-package.md"), refines descriptions with implementation details (e.g., specifying file counts like "~20 files", "~9 files"), marks status transitions (pending → in_progress), or splits vague tasks into concrete items
- Last observed: 2026-03-19T06:29:33Z
- Context: Large UI component migration task (shifting from local copies to @harness/ui package); initial task list was 10 items, grew to 14 items as implementation details surfaced

## Rationale
Rather than writing a complete task list upfront, incremental refinement catches implementation details that only become clear during investigation (like discovering you need to update components.json or add Claude rules). This approach keeps the task list accurate and actionable without being prescriptive at the start.
