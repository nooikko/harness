---
id: async-error-handling-state-pattern
trigger: when implementing async operations that can fail in React components
confidence: 0.5
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Async Error Handling State Pattern

## Action
Always add error state, wrap async operations in try/catch, and display errors in the UI.

## Evidence
- Observed 3 times in session 6148e335-52e0-4235-83b4-e8810fdf5c9e
- Pattern: Add useState for error state, wrap async operation in try/catch, display error conditionally in UI
- Implementations:
  - ChatInput: `uploadError` state + try/catch in `stableOnSubmit` callback for file upload
  - TextPreviewContent: `loadError` state + error boundary in useEffect fetch
  - ThreadAttachmentsPanel: `loadError` state + try/catch in `loadFiles` callback
- Last observed: 2026-03-14T23:07:20Z
