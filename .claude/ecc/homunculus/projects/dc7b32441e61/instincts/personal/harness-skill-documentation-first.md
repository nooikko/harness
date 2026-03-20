---
id: harness-skill-documentation-first
trigger: when understanding harness workflows or implementing tasks with skill/command references
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Harness Skill Documentation First

## Action
When working with harness project tasks, read relevant SKILL.md files and documentation guides before implementation to understand the execution workflow.

## Evidence
- Observed 9 times in session 905fb573-64e3-4089-9b22-87ac0b25d2dc
- Pattern: Each exploration session reads SKILL.md files from .claude/skills/ directory (engine, do, handoff, catchup, etc.)
- Pattern: Guide files are read to understand project conventions (longform-guide, shortform-guide)
- Pattern: Command documentation is consulted before executing commands (loop-start, loop-status)
- Last observed: 2026-03-13

## Context
The harness project uses a skill-driven task execution model where SKILL.md files document execution patterns, orchestration workflows, and task delegation strategies. Reading these first prevents implementation errors and aligns with project conventions.
