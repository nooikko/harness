---
id: discovery-driven-exploration
trigger: when exploring unfamiliar systems or looking for available tools and capabilities
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Discovery-Driven Exploration

## Action
When looking for tools, skills, or capabilities, use Bash find/grep to discover what exists before diving into deep documentation reading.

## Evidence
- Observed 5+ times in session 905fb573-64e3-4089-9b22-87ac0b25d2dc
- Pattern: Bash find/grep to locate skill files (.opencode/commands/, SKILL.md) → Read discovered files
- Pattern: Bash ls to list available infrastructure → Read specific files of interest
- Pattern: Search for capabilities before deciding implementation approach
- Last observed: 2026-03-13

## Context
The harness project has extensive distributed infrastructure (skills, commands, agents, patterns). Discovery-first exploration reveals what's available, prevents reimplementation of existing tools, and ensures leveraging the right patterns for the task.
