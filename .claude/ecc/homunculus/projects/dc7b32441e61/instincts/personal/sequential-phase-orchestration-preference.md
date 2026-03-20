---
id: sequential-phase-orchestration-preference
trigger: when planning multi-step implementation or handling complex features with multiple concerns
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Sequential Phase-Based Orchestration Preference

## Action
Structure multi-step work as sequential phases (RESEARCH → PLAN → IMPLEMENT → REVIEW → VERIFY) with explicit phase outputs, clear handoffs, and phase-specific success criteria.

## Evidence
- Observed 4+ explicit pattern-focused reads in session 905fb573-64e3-4089-9b22-87ac0b25d2dc
- Pattern: Reads continuous-agent-loop, autonomous-loops, and verification-loop skills specifically
- Pattern: Focus on phase sequencing, context persistence, and quality gates between phases
- Pattern: Agent research output explicitly discusses multi-phase orchestration (RESEARCH → PLAN → IMPLEMENT → REVIEW → VERIFY)
- Pattern: Interest in phase outputs as files that become inputs for next phase
- Last observed: 2026-03-13

## Context
The harness project uses sophisticated multi-agent orchestration where each phase has distinct responsibility and produces outputs that feed the next phase. This pattern ensures clear scope boundaries, reusable outputs, and recovery points if phases fail.
