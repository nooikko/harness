---
id: cascading-test-failure-investigation
trigger: when fixing one test reveals failures in dependent test suites, especially hook or plugin tests
confidence: 0.65
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Cascading Test Failure Investigation

## Action
When fixing a test (e.g., updating component assertion counts) causes failures in dependent test suites (e.g., hook error handling tests), use targeted grep and read operations to identify related test assertions that need similar updates.

## Evidence
- Observed in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Edit admin-sidebar.test.tsx to update assertion from 7→9 links at 01:50:11Z
- Subsequent test runs at 01:51:07Z and 01:51:25Z show 4 failures in delegation-loop hook error tests
- Investigation sequence: Grep for hook test code (01:51:19Z) → Grep for specific assertions (01:51:34Z) → Read test file (01:51:38Z)
- Same 4 hook error tests fail across multiple runs, indicating they require similar assertion updates
- Last observed: 2026-03-17T01:51:38Z

## Context
When component/fixture changes affect expectations (like navigation link count), dependent test suites that validate infrastructure using those components may fail. Hook error tests that validate plugin behavior often depend on component and feature assertions being correct.

## Investigation Pattern
1. Run tests after initial fix to identify cascading failures
2. Use grep to locate related test code in affected test file
3. Use targeted grep searches to find specific assertions that match the pattern of changes
4. Read full test context to understand update scope
5. Apply similar assertion updates in dependent test suites
