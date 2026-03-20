---
id: incremental-targeted-edits
trigger: when integrating a complex feature that requires changes to multiple aspects of a file (imports, types, state, handlers, rendering)
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Incremental Targeted Edits for Feature Integration

## Action
Make multiple small, focused edits to a single file rather than rewriting it all at once; layer changes in logical phases (imports → types → state → handlers → UI).

## Evidence
- Observed 25+ targeted edits across 8+ files in 2026-03-14 and 2026-03-17 sessions
- 2026-03-14 session (file upload feature):
  - chat-input.tsx: 6 sequential edits adding file upload feature
    - Edit 1: Add Paperclip and FileChip imports
    - Edit 2: Add StagedFile type and uploadStagedFiles function
    - Edit 3: Add state management (stagedFiles, isUploading)
    - Edit 4: Add file selection handler
    - Edit 5: Update submission to upload files
    - Edit 6: Render file input and staged chips
  - thread-header.tsx: 2 edits to add attachments panel
  - send-message.ts: 2 edits to accept and link fileIds
  - chat-area.tsx: 2 edits to thread fileIds through submission
- 2026-03-17 session (delegation plugin concurrency & orchestrator stability):
  - packages/plugins/delegation/src/__tests__/index.test.ts: 2 edits
    - Edit 1: Add imports (beforeEach, state export)
    - Edit 2: Add concurrency guard test describe block before main tool tests
  - apps/orchestrator/src/orchestrator/index.ts: 2 edits
    - Edit 1: Add null check for pipeline.handleMessage at invocation
    - Edit 2: Refine null check placement (moved inside handler)
- 2026-03-17 evening session (harness bug fixes M1-M7):
  - parse-verdict.ts (M4): Single targeted edit refactoring regex from simple .test() to matchAll() for correctness, ~6 lines + explanatory comments
  - plugin-contract/index.ts (M5): Single targeted edit adding JSDoc documentation to onPipelineComplete hook, ~4 lines
  - create-session.ts (M6): Single targeted edit adding q.close() in error handler for zombie process cleanup, 2 lines
  - delegation-loop.ts (M7): Planned targeted edit for iteration count fix (grep used for context before edit)

Pattern: Dividing feature additions and fixes into logical layers across multiple targeted edits instead of one large rewrite. This maintains file readability and creates atomic, reviewable changes. Refinement edits are common when optimizing error handling or test structure. Bug fixes follow same discipline: minimal, focused changes with explanatory comments only when behavior is non-obvious.

Last observed: 2026-03-17 23:50:19
