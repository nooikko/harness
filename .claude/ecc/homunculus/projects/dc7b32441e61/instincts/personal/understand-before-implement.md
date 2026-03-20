---
id: understand-before-implement
trigger: when implementing new code, tests, or features
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Understand Before Implement

## Action
Always read existing similar code, tests, and patterns from the codebase before writing new code.

## Evidence
- Observed 6+ times in session 4856ee0a-a85e-44ce-988d-133f25f77051 across multiple phases
- Phase 3 (error handling): Before adding getAllPluginNames() to plugin-registry, read delegation-loop.test.ts (error handling tests), plugin-registry/index.ts, run-hook.ts
- Phase 5 (admin UI): Before building error dashboard, read threads/page.tsx, agent-runs/page.tsx, admin-sidebar.tsx to understand page structure
- Pattern: Every implementation task starts with 2-4 file reads to understand existing patterns and conventions
- Areas covered: error handling patterns, plugin structure, UI page layouts, hook patterns
- Last observed: 2026-03-17T01:39:13Z

## Rationale
Understanding existing patterns prevents rework, ensures consistency with codebase conventions, and surfaces the right mocking/testing approaches already established in the project.
