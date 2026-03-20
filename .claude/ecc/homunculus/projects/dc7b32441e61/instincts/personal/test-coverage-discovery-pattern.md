---
id: test-coverage-discovery-pattern
trigger: when auditing or validating test coverage across multiple systems
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test Coverage Discovery Pattern

## Action
When validating test coverage, use systematic Glob queries to discover all test files and their corresponding implementations, then Read each file to inspect coverage details.

## Evidence
- Observed 4+ times in session 4856ee0a-a85e-44ce-988d-133f25f77051 (2026-03-15T23:45:37Z)
- Pattern: multiple Glob searches for different subsystems → sequential Read operations on discovered files
- Glob queries targeted: integration tests (15 files), task plugin helpers (6 files), search API (8 files), vector search (8 files)
- Last observed: 2026-03-15T23:45:46Z
- Context: User requested validation of integration and unit tests across different plugin systems

## Notes
This is the discovery phase for coverage audits. Start with broad Glob patterns for each subsystem (tests/, src/_helpers/, api routes) before diving into individual file examination. This methodical approach ensures comprehensive coverage validation across the monorepo's plugin architecture.
