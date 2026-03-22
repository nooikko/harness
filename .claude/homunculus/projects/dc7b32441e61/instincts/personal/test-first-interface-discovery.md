---
id: test-first-interface-discovery
trigger: when exploring unfamiliar modules or components in the harness codebase
confidence: 0.6
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test-First Interface Discovery

## Action
When exploring a new module or component, read test files first to understand the expected interfaces, data structures, and behavior before examining implementation code.

## Evidence
- Observed 4 times in session 970f6bb0-139e-4fbc-81a1-cfb02bb4e5a1
- Observed 4 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Read project-plugin.test.ts (127 lines) → page.test.tsx (55 lines) → nav-projects.test.tsx (132 lines) → new-project-form.test.tsx (128 lines)
- Current pattern: Sequential reads of create-task-dialog.test.tsx → task-list.test.tsx → task-filters.test.tsx → task-detail-panel.test.tsx
- Tests reveal the public API, expected return types, error states, and typical usage patterns
- Last observed: 2026-03-15T23:42:56Z

## Why
Tests codify expected behavior and interfaces more clearly than implementation code. Reading tests first provides a specification of what the module should do, making it easier to understand the implementation details when reading them afterward. Tests also show edge cases and error handling requirements upfront.
