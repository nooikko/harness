---
id: test-convention-consistency
trigger: when creating new test files or test suites
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test Convention Consistency

## Action
Apply consistent test file organization and mock patterns: use `__tests__/` subdirectories, one test file per source module, arrow functions only, `vi.mock()` before `await import()`, and mock @harness/database + next/cache following existing patterns.

## Evidence
- Observed 3+ times across task descriptions in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Task instructions for project action tests: "Follow the exact mock pattern used by existing action tests in the same directory"
- Task instructions for integration tests: reference to testcontainers pattern and prisma mocking
- Project conventions listed across multiple test creation prompts: arrow functions, __tests__/ placement, vi.mock ordering
- Pattern appears in: project plugin tests, task integration tests, and project action test task descriptions
- Last observed: 2026-03-15 23:49:39Z

## Rationale
Consistency reduces cognitive load, enables tool developers to find tests quickly, and ensures mocks are wired correctly following the established approach.
