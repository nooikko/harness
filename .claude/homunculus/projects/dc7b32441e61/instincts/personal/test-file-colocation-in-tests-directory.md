---
id: test-file-colocation-in-tests-directory
trigger: when creating or moving test files
confidence: 0.85
domain: file-patterns
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test File Colocation in __tests__/ Directories

## Action
Always place test files (*.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx) inside `__tests__/` directories colocated with their source code, not directly alongside source files.

## Evidence
- Enforced by pre-tool-use hook: block-test-file-location.py (reads at 2026-03-15T23:51:30Z)
- Observed in all test file paths in session output:
  - src/_helpers/__tests__/collections.test.ts
  - src/app/tasks/_actions/__tests__/create-task.test.ts
  - src/app/(chat)/chat/_components/__tests__/nav-links.test.tsx
  - src/app/api/search/_helpers/__tests__/parse-filters.test.ts
- Hook blocks creation of test files outside __tests__/ directories with clear error message
- Pattern applied consistently across all 16+ test files in session
- Last observed: 2026-03-15T23:51:30Z

## Implementation Details
- Create __tests__/ directory at the same level as the source file being tested
- Move test file into that directory
- Hook will reject attempts to create test files outside __tests__/ directories
- This ensures tests are colocated with source code for better discoverability and organization
