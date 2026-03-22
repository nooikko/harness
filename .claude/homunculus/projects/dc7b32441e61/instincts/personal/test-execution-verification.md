---
id: test-execution-verification
trigger: when writing or updating test files, before moving to next task
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test Execution Verification After Writing Tests

## Action
Immediately run the relevant test suite via bash after writing or updating test files to verify tests pass before considering the task complete.

## Evidence
- Observed 5+ times in session eb5a3960-663f-428c-81b0-90c58809f930
- Pattern: After Write tool (test files), followed by Bash tool (vitest run) with passing results
- Examples: 19:00:12 full test suite (passing), 19:01:32 outlook-event tests (passing), 19:02:09 outlook-calendar package tests (passing)
- All test runs completed successfully with green status
- Last observed: 2026-03-19 19:02:09

Rules:
- Run tests immediately after writing/modifying test files
- Verify all tests pass before proceeding
- Run at appropriate scope: specific test file, feature directory, or full package
- Check output for test count and pass/fail status
- If tests fail, fix before moving forward (don't skip test verification)
