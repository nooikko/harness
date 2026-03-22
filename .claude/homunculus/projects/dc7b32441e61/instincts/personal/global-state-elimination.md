---
id: global-state-elimination-via-invocation-isolation
trigger: when eliminating global state references and replacing with per-invocation isolation
confidence: 0.85
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Global State Elimination via Per-Invocation Isolation

## Action
Replace global setter dependencies (setActiveTaskId, setActiveTraceId, setActiveThread, consumeToolBlocks) with per-invocation local state passed through function parameters.

## Evidence
- Observed 6 times in session 31c444d9-8205-4bd5-af0b-09f5495a3367 (2026-03-17T18:39:57 → 18:40:43)
- Pattern: Remove setter functions from contextRef → add local arrays/values → pass via InvokeOptions or function closure
- Removes dependency injection of mutating functions, replacing with immutable parameter passing
- Last observed: 2026-03-17 Phase 4 orchestrator refactoring

## Examples
- `consumeToolBlocks?()` callback replaced with local `pendingBlocks` array + `pendingBlocks.shift()` in onMessage
- `setActiveTaskId?.()` removed from OrchestratorDeps, taskId passed via InvokeOptions instead
- `setActiveTraceId?.()` removed from sendToThread, traceId bound to local logger via createChildLogger

## When to Apply
- When abstracting away plugin context mutation
- When isolating per-request state from session-level globals
- When passing state through closure is cleaner than contextRef mutations
