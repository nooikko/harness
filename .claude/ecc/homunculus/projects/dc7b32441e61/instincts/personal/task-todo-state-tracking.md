---
id: task-todo-state-tracking
trigger: when implementing features with multiple sequential steps or dependencies
confidence: 0.75
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Task-Driven Workflow via TodoWrite

## Action
Use TodoWrite to track task state transitions (pending → in_progress → completed) throughout implementation, marking each task complete immediately upon finishing it rather than batching completions.

## Evidence
- Observed 6 TodoWrite invocations in session 31c444d9-8205-4bd5-af0b-09f5495a3367 (2026-03-17T23:08:01Z):
  - Initial todos: Create semaphore helper (pending) → Wire semaphore (pending) → Add tests (pending) → Run tests (pending)
  - Edit 1: Create delegation-semaphore.ts → Mark as completed
  - Edit 2: Wire semaphore into tool handler → Mark as completed
  - Edit 3: Add semaphore unit tests → Mark as completed
  - Edit 4: Add concurrency guard tests → Mark as completed
  - Bash test run → Mark "Run tests" as completed
- Session 3db3a930-228b-4cee-8665-92a3648dd54b (2026-03-17T23:12:00Z):
  - Phase 0 completed, Phases 1-2 marked in_progress, remaining marked pending
  - Clear progression tracking across 6 todo state updates
- Pattern: Todos created at start of work, then updated to in_progress when starting, completed immediately upon finishing
- Last observed: 2026-03-17T23:12:00Z

## Implementation Details
- TodoWrite is invoked after each discrete work unit completes (not batched)
- Only one task should be in_progress at any time
- Task states flow: pending → in_progress → completed
- Tasks that become blocked create a new subtask rather than staying in_progress
- This provides real-time visibility of what's done vs. what remains

## Context
- Pairs well with incremental-targeted-edits (each edit maps to a todo update)
- Complements edit-test-immediate-verification (test result triggers todo update)
- Useful for multi-file features and multi-phase refactoring work
