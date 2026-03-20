---
id: sequential-quality-verification
trigger: when implementing features or making code changes in harness
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Sequential Quality Verification Workflow

## Action
After implementing features, run quality checks in this specific sequence: typecheck → unit tests → code review before considering work complete.

## Evidence
- Observed 3 verification steps in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Step 1: `tsc --noEmit` typecheck at 22:33:28
- Step 2: vitest test suite at 22:33:32 (1090 tests passed)
- Step 3: Agent-based code review at 22:34:08 + file inspection
- Pattern: Catches type errors first, runtime issues second, design/logic issues in review
- Last observed: 2026-03-15T22:33:45Z

## Rationale
Type checking before tests prevents false positives from type violations. Tests before review ensure functional correctness before design review, reducing review feedback cycles.
