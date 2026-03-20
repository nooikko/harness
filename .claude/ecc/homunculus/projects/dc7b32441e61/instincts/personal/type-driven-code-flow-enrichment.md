---
id: type-driven-code-flow-enrichment
trigger: when working with types that flow through multiple files (processors, consumers, handlers) and need to enrich their handling
confidence: 0.6
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Type-Driven Code Flow Enrichment

## Action
When expanding a type's handling across the codebase, follow this workflow: (1) grep for the type to find all usages, (2) read the type definition to understand structure, (3) sequentially read each consumer/processor file in logical dependency order (producer → handler → UI), (4) edit handlers to include additional metadata fields captured from source data.

## Evidence
- Observed 4 times in session 4856ee0a-a85e-44ce-988d-133f25f77051 (2026-03-17)
- Pattern: Read tool-result-block.tsx → persist-stream-events.ts → map-stream-event.ts → plugin-contract/index.ts (InvokeStreamEvent type)
- Pattern: Grep searches for InvokeStreamEvent type across codebase (3 grep operations)
- Pattern: Edit map-stream-event.ts to expand tool_use_summary handling with tool_use_id, tool_name fields
- Pattern: Sequential reads trace how events flow through the system, then enrichment edits ensure metadata propagates through each layer
- Last observed: 2026-03-17T00:37:23Z

## Context
Complex types like InvokeStreamEvent flow through multiple layers (SDK mappers → processors → persistence → UI components). When adding new fields or enriching handling, sequential reading of the dependency chain ensures all layers properly handle the new data. This pattern prevents metadata loss at any layer.
