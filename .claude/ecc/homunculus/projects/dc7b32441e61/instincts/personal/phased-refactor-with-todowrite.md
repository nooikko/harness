---
id: phased-refactor-with-todowrite
trigger: when implementing multi-phase architectural refactoring or large coordinated changes
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Phased Refactoring with TodoWrite Tracking

## Action
Break large refactoring into numbered phases with clear phase descriptions, create a TodoWrite task list to track them, and update it as each phase completes.

## Evidence
- Observed 3 times in session 31c444d9-8205-4bd5-af0b-09f5495a3367
- Pattern: TodoWrite used to create 8-phase refactoring plan (context isolation feature), then updated twice to mark Phase 1 complete and Phase 2 as in_progress
- Coordinated with corresponding Edit operations implementing each phase
- Last observed: 2026-03-17T18:38:16Z

## Context
The harness project uses explicit phase-based planning for large architectural changes. Each phase is tracked in TodoWrite with clear descriptions of what needs to change (e.g., "Phase 2: Session layer — meta on PendingRequest, drainQueue activation"). The phase structure makes coordinated multi-file refactoring visible and trackable.
