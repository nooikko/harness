---
id: test-alongside-implementation
trigger: when creating React components, hooks, or utility functions
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Create Test Files Alongside Implementation

## Action
Always create a corresponding test file in a colocated `__tests__` directory whenever writing a new component, hook, or utility function. Use the pattern `<name>.tsx` + `<name>.test.tsx` in the same parent directory.

## Evidence
- Observed 8+ times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Reinforced pattern: Plugin helpers follow same structure (settings-schema.test.ts, youtube-music-auth.test.ts, device-alias-manager.test.ts, oauth-routes.test.ts, device-routes.test.ts)
- Component pattern: highlight-matches.tsx paired with highlight-matches.test.tsx; use-recent-searches.ts with use-recent-searches.test.ts; search-filter-chips.tsx with search-filter-chips.test.tsx
- All test files created immediately after implementation
- All tests placed in `__tests__` subdirectory maintaining the same structure
- Last observed: 2026-03-16T21:06:41Z (music plugin helpers)

## Implementation Notes
- Tests use consistent naming: `<original-filename>.test.<extension>`
- Tests are colocated in `__tests__` folder within the same parent directory
- Tests are comprehensive (covering happy path, edge cases, error states)
- This applies to components, hooks, and utilities in the codebase
