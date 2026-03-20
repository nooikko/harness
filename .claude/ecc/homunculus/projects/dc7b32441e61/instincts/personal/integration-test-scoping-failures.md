---
id: integration-test-scoping-failures
trigger: when running integration tests and failures appear in project scoping or resource listing
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Consistent Integration Test Failures in Project Scoping

## Action
When integration tests fail with "project scoping" or "includeGlobal" in the test name, or when multiple resource-listing tools (list_tasks, search, list_folders) fail across different plugins, investigate the scoping/filtering logic rather than individual tool implementations.

## Evidence
- Observed 4+ test failures consistently appearing across multiple bash runs (18:51:07, 18:51:58, 18:52:03, 18:52:47 UTC on 2026-03-17)
- Recurring failures:
  - `list_tasks project scoping with includeGlobal` (AssertionError: expected [] to include 'Project task')
  - `list_tasks returns tasks with dependency info and respects status filter`
  - `search tool returns formatted results` (music-plugin)
  - `list_folders returns folder list` (outlook-plugin)
- Pattern suggests systematic issue with project/global scope filtering, not individual tool bugs
- Last observed: 2026-03-17 18:52:47

## Context
These failures suggest a common root cause in how project scoping is being handled across multiple plugins, likely related to the `projectId`/`threadId`/`scope` column changes to plugin tool filtering logic.
