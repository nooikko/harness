---
id: parallel-agent-layer-exploration
trigger: when understanding a complex cross-cutting feature or system in the monorepo
confidence: 0.65
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Parallel Agent Exploration of System Layers

## Action
When exploring a feature that spans multiple architectural layers (database, backend logic, frontend UI, data safety), spawn multiple agents in parallel to explore each layer independently, then synthesize findings. Assign agents by layer: schema/backend, UI/components, data isolation/architecture concerns.

## Evidence
- Observed 3 times in session 970f6bb0-139e-4fbc-81a1-cfb02bb4e5a1
- Pattern: Agent 1 "Projects schema and backend" → Agent 2 "Projects UI components" → Agent 3 "Projects data isolation"
- Each agent explores independently without waiting, revealing perspective-specific insights faster than sequential reading
- Last observed: 2026-03-13

## Why
This monorepo's architecture separates concerns into distinct layers (database/Prisma, orchestrator/plugins, web/UI). Understanding a feature fully requires examining it from multiple perspectives simultaneously. Parallel agents prevent bottlenecks and often reveal integration gaps that sequential exploration would miss.
