---
id: comprehensive-search-before-edit
trigger: when making changes to code that may have multiple occurrences or dependencies
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Comprehensive Search Before Making Code Changes

## Action
Use multiple Grep searches to locate all occurrences and dependencies of code before editing, then search again after editing to find other references that may need updating.

## Evidence
- Observed 4 Grep calls in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern: Developer searched for deleteThread references (00:41:58), then usage in components (00:42:10), then made one targeted edit (00:42:38), then searched for hardcoded '/chat' paths (00:42:44, 00:42:49)
- Shows two-phase search: before-edit to understand scope, after-edit to find related code that needs updating
- Last observed: 2026-03-17 in routing bug fix workflow
