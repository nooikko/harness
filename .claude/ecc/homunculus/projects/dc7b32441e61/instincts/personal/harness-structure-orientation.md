---
id: harness-structure-orientation
trigger: when starting work in harness project or exploring unknown areas
confidence: 0.75
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Harness Project Structure Orientation

## Action
When orienting to the harness project, explore the .claude directory structure to understand available skills, tools, and infrastructure before starting work.

## Evidence
- Observed 6+ times in session 905fb573-64e3-4089-9b22-87ac0b25d2dc
- Pattern: Initial exploration includes ls .claude and finding all .md files in .claude/skills/
- Pattern: Searches for specific infrastructure files (loop-start.md, loop-status.md, engine/SKILL.md)
- Pattern: Discovers available skills and commands to understand execution options
- Last observed: 2026-03-13

## Context
The harness project has complex infrastructure (skills, hooks, agents, research, rules, worktrees) organized under .claude/. Understanding this structure before implementation prevents path errors and ensures proper tool usage.
