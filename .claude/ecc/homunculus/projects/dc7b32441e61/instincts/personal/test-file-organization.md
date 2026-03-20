---
id: test-file-organization
trigger: when creating test files for source code
confidence: 0.85
domain: file-patterns
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test File Organization Structure

## Action
Co-locate tests in a __tests__ subdirectory within the same folder as the source code, using .test.ts or .test.tsx extension to match the source file type.

## Evidence
- Observed 10+ times across sessions 4856ee0a and bbe56a1c
- Pattern: All new test files placed in __tests__ folder parallel to source
  - source: src/_helpers/qdrant-client.ts → test: src/_helpers/__tests__/qdrant-client.test.ts
  - source: _components/nav-links.tsx → test: _components/__tests__/nav-links.test.tsx
  - source: pages/tasks/page.tsx → test: tasks/__tests__/page.test.tsx
  - source: _components/connect-button.tsx → test: _components/__tests__/connect-button.test.tsx (session bbe56a1c)
  - source: _components/disconnect-button.tsx → test: _components/__tests__/disconnect-button.test.tsx (session bbe56a1c)
  - source: _components/oauth-status-message.tsx → test: _components/__tests__/oauth-status-message.test.tsx (session bbe56a1c)
- Consistent naming: test filename matches source filename + .test extension
- Last observed: 2026-03-17T03:26:46Z

## Implementation Details
- Create __tests__ subdirectory in the same folder as the source
- Use .test.ts for TypeScript source files, .test.tsx for React components
- Tests are automatically discovered by Vitest with this pattern
