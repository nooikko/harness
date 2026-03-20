---
id: component-prop-refactoring-test-sync
trigger: when adding a new prop to a component that is used across multiple components in the tree
confidence: 0.85
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Component Property Refactoring with Test Synchronization

## Action
When adding a prop to a component, systematically propagate it up the component tree from data source to leaf components, then use TypeScript errors to identify and fix all test fixtures that reference the modified component.

## Pattern
1. Identify which component needs the new prop
2. Read the component file before editing
3. Add the prop to the component's type definition
4. Update the component function signature destructuring
5. Update JSX that passes the prop to child components
6. Propagate up: update parent components to compute/pass the data
7. Run TypeScript check to reveal test failures
8. Systematically fix each test file by adding the new prop to all test fixtures
9. Re-run tests to verify

## Evidence
- Observed 6+ times across multiple sessions
- **Session 970f6bb0 (2026-03-13)**: 5+ iterations
  - thread-header.tsx: added currentProjectId + projects props
  - thread-list-item.tsx: added projectId + projects props
  - nav-chats.tsx: added projects prop
  - thread-sidebar.tsx: computed and passed projects
  - page.tsx: fetched projects data
  - manage-thread-modal.test.tsx: updated 13 test cases with missing props
  - nav-chats.test.tsx: updated test fixtures
- **Session 0b1b580e (2026-03-18)**: 1 iteration
  - connected-accounts.tsx: refactored status logic to use derived function
  - connected-accounts.test.tsx: added new test cases for `deriveConnectionStatus` behavior
- Pattern: cascading prop updates followed by test fixture synchronization
- Last observed: 2026-03-18T00:28:23Z

## Why This Pattern Matters
This workflow ensures type safety by letting TypeScript identify all usages, rather than manually hunting for tests. Reduces the risk of missing a test fixture update that could mask type errors.
