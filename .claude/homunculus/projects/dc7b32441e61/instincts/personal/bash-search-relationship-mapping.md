---
id: bash-search-relationship-mapping
trigger: when understanding how a concept or relationship manifests across multiple architectural layers
confidence: 0.75
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Bash grep search to map relationship patterns

## Action
Use Bash grep/find to systematically locate all files containing a relationship concept (e.g., "projectId", "createThread", "agentId"), then Read those files to understand how the concept flows through each layer (database → web → orchestrator → plugins).

## Evidence
- Observed 7+ times in session 970f6bb0-139e-4fbc-81a1-cfb02bb4e5a1
- Observed 7+ times in session 4856ee0a-a85e-44ce-988d-133f25f77051 (latest: searching durationMs, toolUseId, InvokeStreamEvent, tool_call)
- Pattern: Bash grep/find for keyword → Read discovered files → Identify pattern manifestation across layers
- Examples: searching projectId relationships, createThread implementations, loadFileReferences patterns, agentId cascades; data model flow (durationMs → tool persistence → UI rendering)
- Current pattern: Bash grep for data model identifiers (InvokeStreamEvent, tool_call patterns) across plugin/db/UI layers
- Last observed: 2026-03-17T00:32:30Z
- Workflow: Bash finds all occurrences → Read each location → Understand data flow → Repeat with related concepts

## Why
This monorepo has concepts (relationships, data flows, feature patterns) that manifest across multiple layers simultaneously. Grepping first discovers all touchpoints before reading, preventing missed implementations and revealing how concepts cascade through the architecture. More efficient than layer-by-layer review.
