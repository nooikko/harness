---
id: optional-parameter-scope-boundaries
trigger: when understanding how data filtering or scope determination works across layers
confidence: 0.85
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Optional Parameter Scope Boundaries

## Action
When examining filtering, scope classification, or data isolation patterns, recognize that optional parameters (especially `projectId`, `threadId`) determine scope boundaries across multiple layers. Read all files handling these parameters together to understand how scope is consistently applied.

## Evidence
- Observed 8 times in session 970f6bb0-139e-4fbc-81a1-cfb02bb4e5a1
- Pattern: Optional `projectId` parameter changes filtering behavior in:
  - resolve-or-create-thread.ts (creation context)
  - check-reflection-trigger.ts (memory scope filtering)
  - classify-memory-scope.ts (scope type classification)
  - retrieve-memories.ts (memory filtering)
  - score-and-write-memory.ts (memory write context)
  - load-file-references.ts (file scope conditions)
  - load-agent.ts (agent project association)
  - setup-delegation-task.ts (task scope context)
- Last observed: 2026-03-13T22:45:19Z
- Workflow: Read functions that use `projectId` parameter → Identify if present/null determines different behavior → Understand scope classification rules

## Why
In this monorepo, optional parameters create architectural boundaries (project-scoped vs. agent-scoped vs. thread-scoped). Understanding one instance of projectId handling is insufficient; the same filtering pattern appears consistently across plugins (identity, context, delegation). Reading these together reveals the scope-determination framework and prevents scope-leak bugs.
