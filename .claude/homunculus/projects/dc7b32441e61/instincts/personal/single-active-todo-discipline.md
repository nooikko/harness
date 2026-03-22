---
id: single-active-todo-discipline
trigger: when managing planning or implementation tasks, maintain exactly one in_progress task at a time in TodoWrite
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Single Active Task Discipline

## Action
Keep exactly one task as in_progress in TodoWrite; transition to next task only after marking current one completed.

## Evidence
- Observed 6 TodoWrite updates in session 2464ac8f (2026-03-14) and 2+ updates in session 31c444d9 (2026-03-17 evening)
- 2026-03-14 sequence: Plan tasks system → Plan Microsoft Graph → Plan file uploads → Plan responses → Plan project UI → Plan search → Plan cron → Plan news → Plan agent-malleable
- 2026-03-17 sequence (M1-M7 harness bug fixes):
  - Initial state: M2 in_progress, others pending
  - Update 1: M1→completed, M2→completed, M3→completed, M4→in_progress (3 tasks completed before moving to next)
  - Update 2: M4→in_progress (stable), others pending
  - Pattern: Maintains exactly one task in in_progress; moves to next only after prior task transitions to completed
- Strict adherence across sessions: no task left in in_progress when moving to next
- Last observed: 2026-03-17T23:49:25Z

## Why
Maintains clear focus and prevents context fragmentation during multi-feature planning sessions. Helps identify which planning phase is active and ready for discussion/handoff.
