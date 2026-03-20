---
id: harness-taskmaster-state-check
trigger: when about to execute harness tasks or checking project state
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Harness Taskmaster State Check

## Action
Before executing harness project tasks, check .taskmaster directory to verify current task state, configuration, and PRD documentation.

## Evidence
- Observed 3 times in session 905fb573-64e3-4089-9b22-87ac0b25d2dc
- Pattern: Checks .taskmaster directory structure and contents
- Pattern: Reads state.json for current execution state
- Pattern: Consults .taskmaster/docs/prd-surgical-fixes.md for architecture context
- Last observed: 2026-03-13

## Context
The harness project uses taskmaster for task orchestration and state tracking. The .taskmaster directory contains critical configuration and PRD documentation needed for correct task execution.
