---
id: prop-type-test-fixture-sync
trigger: when component prop types are expanded with new properties
confidence: 0.85
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Prop Type Test Fixture Synchronization

## Action
When component prop types are expanded, immediately update all test fixtures to match—use TypeScript errors as a checklist to find all affected test cases.

## Evidence
- Observed 14+ test failures in `manage-thread-modal.test.tsx` when `ManageThreadModalProps` was expanded
- All failures were identical: `Type '...' is missing the following properties from type 'ManageThreadModalProps': currentProjectId, projects`
- Pattern: Component signature changes → TypeScript errors pinpoint exact test fixtures needing updates
- Source: Session 970f6bb0-139e-4fbc-81a1-cfb02bb4e5a1, timestamp 2026-03-13T22:52:56Z
- Last observed: 2026-03-13

## Why It Matters
Tests fail predictably and uniformly when component props change. The error output provides a complete list of affected test cases. Fixing them all at once prevents partial test coverage and ensures the test file remains a valid reference for the component API.
