---
id: multi-layer-framework-review
trigger: when implementing features that span orchestrator, database, and plugin layers
confidence: 0.75
domain: file-patterns
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Multi-Layer Framework Review Before Implementation

## Action
When implementing features that interact with multiple architectural layers in this monorepo, review plugin-contract, database schema, and orchestrator config together to understand compatibility requirements and integration points.

## Evidence
- Observed 8+ times across sessions 8eb534ab and bbe56a1c (2026-03-13 to 2026-03-16)
- Pattern: Reading plugin-contract, schema.prisma, .env.example, config files, existing plugin implementations, and plan documents sequentially when planning cross-layer features
- Session bbe56a1c (2026-03-16): 4 consecutive Read calls examining instinct status, existing plan, project plugin, and plugin-contract before implementing Microsoft Graph integration
- Specific files consulted multiple times: plugin-contract (3x), existing plugins (2x), schema.prisma (2x), .env.example (2x), existing plans (1x)
- Last observed: 2026-03-16T07:06:49Z (Microsoft Graph plugin planning)

## Why
This monorepo's architecture has clear layer dependencies:
- Plugin system defines contracts that orchestrator enforces
- Database schema constrains what orchestrator and plugins can store
- Config determines environment-specific behavior

Reading these three together prevents architectural mismatches when adding features that span layers.
