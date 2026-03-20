---
id: plan-driven-source-exploration
trigger: when creating or refining architectural plans for multi-file changes
confidence: 0.6
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plan-Driven Source Code Exploration

## Action
After creating or refining architectural plans, immediately read the source files that the plan will affect to verify implementation feasibility and understand the true scope of changes.

## Evidence
- Edited `live-delegation-card.md` twice (2026-03-17 18:32:20, 18:32:29) to refine design decisions and risk assessments
- Created `c1-c2-context-isolation.md` plan (18:35:39)
- Immediately followed by 6 sequential Read operations of affected orchestrator files: plugin-contract, tool-server, orchestrator/index, invoker-sdk/index, and create-session helpers (18:35:43-18:35:48)
- Pattern demonstrates validation: plan creation → source exploration → iterative refinement
- User corrections include adding implementation notes ("correctness fix") and updating risk matrix based on findings

## Notes
This workflow prevents planning disconnects by anchoring abstract designs to concrete code realities before committing to implementation steps.
