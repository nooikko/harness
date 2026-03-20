---
id: agent-research-delegation-before-planning
trigger: when approaching complex features, architecture decisions, or feature implementation plans that require understanding existing code/designs
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Agent-Driven Research Delegation Before Planning

## Action
Dispatch Agent tool with general-purpose or Explore subagent to conduct comprehensive research (read files, survey implementations, trace execution flows) before finalizing implementation plans or architecture decisions.

## Evidence
- Observed 3 times in consecutive sessions (2026-03-17):
  - Agent: summarize 8 AI_RESEARCH files on YouTube/OAuth/Cast authentication
  - Agent: inventory music plugin implementation (13 MCP tools, dual auth, Cast control)
  - Agent: trace AsyncLocalStorage context propagation through orchestrator async flow
- Pattern: Each agent task precedes a planning/decision phase (documentation cleanup prioritization, concurrency fix strategy)
- Last observed: 2026-03-17 18:31:23

## Context
For features involving multiple subsystems, existing implementations, or architectural tradeoffs, delegate reconnaissance work to agents rather than reading files manually. This scales reading effort and reduces context fragmentation when handling 3+ files or complex call chains.

## Related
- Complements structured-agent-prompt-context (agents need detailed task context)
- Usually followed by /plan command for implementation design
- Most useful for: feature inventory, cross-system understanding, code archaeology (tracing a pattern through multiple files)
