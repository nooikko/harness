---
id: async-research-investigation-pattern
trigger: when investigating complex architectural decisions or technical unknowns before implementation
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Async Agent Research Investigation Pattern

## Action
Launch async research agents to investigate complex technical topics, architectural patterns, or unknown dependencies before committing to implementation approaches.

## Evidence
- Observed 5+ times across sessions (9fc9b500, 55ffe247)
- Pattern: Multiple parallel async agents launched to research:
  - Turborepo internal packages design
  - Monorepo consolidation alternatives
  - Real-world examples and patterns
  - Prompt reconstruction and scope audit
  - MCP tool scope validation
- Last observed: 2026-03-14T06:25:34Z

## When to Apply
Before making architectural decisions about:
- Package structure and build optimization
- Prompt assembly and scope boundaries
- Tool safety and data isolation patterns
- Implementation of novel features

Launch agents with specific research prompts that gather information from:
- Official documentation
- Real-world codebase examples
- Best practices and benchmarks
- Edge cases and failure modes

Return to implementation only after gathering enough context to make informed decisions.

## Benefits
- Parallelizes investigation work
- Prevents repeated false starts
- Builds comprehensive understanding before coding
- Supports better architectural decisions
