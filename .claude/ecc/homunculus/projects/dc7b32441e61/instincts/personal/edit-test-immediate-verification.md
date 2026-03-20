---
id: edit-test-immediate-verification
trigger: when making code edits to source or test files
confidence: 0.6
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Immediate Test Verification After Edits

## Action
After each code or test file edit, run the test suite immediately with `vitest run` (or `npm test` in the affected package) to validate changes before moving to the next edit.

## Evidence
- Observed 8+ edit-test cycles across two sessions (2026-03-16 and 2026-03-17)
- Session 2026-03-16T07:16:20Z:
  - Cycle 1: Edit admin-sidebar.tsx (07:16:20) → Bash vitest run (07:16:24) ✓ All tests pass
  - Cycle 2: Edit cast-device-manager.test.ts (07:16:29) → Bash vitest run with coverage (07:16:29) ✓ All 73 tests pass
  - Cycle 3: Edit cast-device-manager.test.ts (07:16:36) → Bash vitest attempt (07:16:38)
- Session 2026-03-17T23:07:39Z:
  - Cycle 4: Edit delegation plugin test file (imports, test suites) → Bash test run (23:08:05) ✓ All 164 tests pass in plugin-delegation
  - Cycle 5: Edit orchestrator/index.ts (null checks, pipeline initialization) → Bash test verification
- Pattern: Each edit is immediately followed by test execution within seconds, with clear pass/fail validation
- Last observed: 2026-03-17T23:08:05Z (164/164 tests passing)

## Workflow Pattern
This is a rapid edit-validate cycle that catches breakage immediately:
1. Edit a file (add import, modify component, add tests)
2. Run tests within seconds
3. Tests pass = move to next edit; Tests fail = diagnose and fix before continuing

This is tighter than the broader sequential quality verification (typecheck → tests → review) and represents the real-time development loop during feature implementation.

## Context
- Commonly paired with comprehensive test additions (adding multiple edge case tests)
- Validates both import statements and test logic consistency
- Faster feedback loop than waiting for full pipeline validation
