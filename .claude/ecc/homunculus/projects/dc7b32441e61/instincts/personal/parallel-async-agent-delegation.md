---
id: parallel-async-agent-delegation
trigger: when breaking down an implementation plan into multiple independent subtasks
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Parallel Async Agent Delegation

## Action
Launch multiple async agents concurrently to handle independent implementation subtasks, providing each with comprehensive context and code style rules to enable autonomous execution.

## Evidence
- Observed 5 times across sessions 970f6bb0-139e-4fbc-81a1-cfb02bb4e5a1 and 4856ee0a-a85e-44ce-988d-133f25f77051
- Session 970f6bb0: 3 agents launched within 14 seconds for (1) projects index page, (2) delegation task inheritance, (3) database seeding
- Session 4856ee0a: 2 agents launched for (1) TraceId propagation, (2) silent catch block fixes
- Each agent prompt includes: detailed task description, specific line numbers, reference code patterns, file paths, and project conventions
- Agents work on independent, non-blocking implementation tasks with full context for autonomous execution
- Allows parallel progress on unrelated components while maintaining detailed context
- Last observed: 2026-03-17T01:35:59Z
