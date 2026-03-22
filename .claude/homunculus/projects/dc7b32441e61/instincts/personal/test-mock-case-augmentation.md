---
id: test-mock-case-augmentation
trigger: when expanding test coverage for components by adding mocks and test cases
confidence: 0.85
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test Mock and Case Augmentation via Edit Operations

## Action
When adding test coverage for React components, use Edit to incrementally add vi.mock() declarations and test cases to test files rather than creating comprehensive test files upfront.

## Evidence
- Observed 10+ times across three sessions in March 2026
- Pattern: Read implementation file → Read/examine test file → Edit to add mocks → Edit to add test cases → Run tests → Fix based on output
- Specific instances from backend OAuth/Calendar workflows (2026-03-17):
  1. handle-oauth-callback.ts: Read implementation (90 lines) → Read test file → Edit to add profile fetch failure test, userPrincipalName fallback test
  2. calendar get-event.ts: Read implementation → Read existing test file
  3. calendar update-event.ts: Read implementation
  4. index.test.ts: New test file created with isProviderSupported tests
- Prior instances (React frontend):
  1. message-item.test.tsx: Added MessageFiles mock (Edit 04:02:11) then file-related test cases (Edit 04:02:20)
  2. message-files.test.tsx: Created (Write 04:02:31), then added test case (Edit 04:03:22), then enhanced FilePreviewModal mock (Edit 04:03:29)
  3. message-list.test.tsx: Added PipelineRunBlock mock (Edit 04:03:44), then added 6 file grouping and pipeline run tests (Edit 04:04:03)
  4. create-task-dialog.test.tsx: Removed unused `act` import (Edit 23:23:33) then added 5 new edge case tests (Edit 23:23:50)
  5. project-chat-input.test.tsx: Added 5 new test cases covering whitespace input, Enter key, and Shift+Enter behavior (Edit 23:23:50)
  6. project-settings-form.test.tsx: Added 7 new test cases for validation, error handling, and state management (Edit 23:24:09)
- Last observed: 2026-03-17T03:32:35Z (oauth module tests)
- Pattern applies consistently to both frontend components and backend helpers
- Pattern structure: Always preceded by reading implementation file to understand structure and error handling before modifying test file

## Related Instincts
- `vitest-extensive-dependency-mocking`: Captures mock strategy; this captures the workflow of adding mocks incrementally
- `staged-feature-implementation-edits`: Similar workflow but for feature implementation code, not test files
