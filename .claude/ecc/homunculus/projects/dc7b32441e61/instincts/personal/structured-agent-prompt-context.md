---
id: structured-agent-prompt-context
trigger: when delegating implementation work to async agents
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Structured Agent Prompt Context

## Action
When delegating implementation tasks to agents, structure prompts with explicit sections: read-first references (design docs, existing code), numbered files to create/modify with descriptions, test expectations, and project conventions. This enables agents to work autonomously with full context.

## Evidence
- Observed 2 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Both agent launches include highly structured prompts:
  1. Read-first references: "Read the design doc first for full context" + "Read the existing code first"
  2. Numbered files section with descriptions of what each file does
  3. Explicit test expectations: "Write tests for all new helper files"
  4. Project conventions: "Project conventions: arrow functions only, no function keyword, one export per helper file"
- Example structure from Phase 2 agent: "## Files to create:" with 6 numbered items, each describing the file's purpose and API
- Example structure from Phase 3 agent: specific sections for PluginContext updates, route mounting logic, and test requirements
- Last observed: 2026-03-16T20:58:47Z

## Why
Clear file-by-file decomposition, explicit conventions, and test expectations prevent agents from missing implementation details and reduce back-and-forth clarifications. Explicit "read first" instructions ensure agents understand design rationale before implementing.
