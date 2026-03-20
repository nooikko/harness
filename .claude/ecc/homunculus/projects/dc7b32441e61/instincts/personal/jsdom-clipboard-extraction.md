---
id: jsdom-clipboard-extraction
trigger: when testing clipboard operations with navigator.clipboard in jsdom environment
confidence: 0.75
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Extract Clipboard Operations for Testability

## Action
When testing navigator.clipboard interactions, extract the clipboard operation into a named, exportable function rather than trying to mock navigator.clipboard directly in tests.

## Evidence
- Observed 9+ attempts using different mocking strategies (Object.assign, Object.defineProperty, vi.stubGlobal)
- All direct navigator mocking approaches in jsdom failed with "cannot set property" or mock not being called
- Solution that worked: extracting `copyToClipboard(text: string)` function from component, allowing tests to use vi.stubGlobal or import+mock the function directly
- Last observed: 2026-03-14T21:56:54Z

## Problem Context
jsdom's navigator object is read-only in most mocking contexts. Attempting to mock it directly causes:
- "Cannot set property clipboard of #<Navigator> which has only a getter"
- Mock functions not being called even when properly configured
- Increasing complexity with each mocking attempt (beforeEach hooks, helper functions, global stubs)

## Solution Pattern
1. Extract clipboard call into a separate, testable function at module level
2. Use that function in the component instead of calling navigator directly
3. Test can now mock that function or stub it with vi.stubGlobal
4. Alternatively, tests can spy on the extracted function

This is more maintainable than trying to intercept navigator mocking.
