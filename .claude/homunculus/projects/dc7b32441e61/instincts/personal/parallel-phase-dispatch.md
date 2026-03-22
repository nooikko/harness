---
id: parallel-phase-dispatch
trigger: when implementing large features with multiple independent phases
confidence: 0.6
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Parallel Phase Dispatch

## Action
Dispatch multiple async agents simultaneously for independent implementation phases rather than sequential execution.

## Evidence
- Observed 2+ times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Phase 1 (Task integration tests, agent a33d1cf00561c05a2) and Phase 2 (Project action tests, agent aead2594c37505562) both launched at 2026-03-15T23:49:33Z
- Pattern: Work items with no dependencies launched concurrently rather than waiting for prior phases
- Test coverage plan had 6 gaps; first 2 phases dispatched in parallel
- Last observed: 2026-03-15 23:49:33Z

## Rationale
Parallelization reduces wall-clock time when phases have no blocking dependencies, allowing independent test creation to proceed simultaneously.
