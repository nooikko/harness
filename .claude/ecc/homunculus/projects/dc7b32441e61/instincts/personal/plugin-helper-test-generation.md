---
id: plugin-helper-test-generation
trigger: when coverage check fails on plugin package helper files
confidence: 0.75
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Helper Test File Generation

## Action
When coverage enforcement fails on helper files in plugin packages, generate a corresponding test file using vitest with `vi.mock()` for all external dependencies.

## Evidence
- Observed 3 times in session bbe56a1c-c659-48a9-87ca-5743e8ba37f1
- Pattern: Read source helper file → Write `__tests__/[filename].test.ts`
- Test structure: `vi.mock()` all imports, `describe()` with `it()` blocks, mock return values matched to actual GraphFetch responses
- Files generated:
  - `packages/plugins/outlook/src/_helpers/list-folders.ts` → test file
  - `packages/plugins/outlook/src/_helpers/reply-email.ts` → test file
  - `packages/plugins/outlook/src/_helpers/validate-graph-id.ts` → test file
- All tests mock GraphFetch and validate formatter output or error handling
- Last observed: 2026-03-17T03:56:51Z
