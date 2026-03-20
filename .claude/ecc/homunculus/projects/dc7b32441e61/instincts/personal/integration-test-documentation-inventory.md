---
id: integration-test-documentation-inventory
trigger: when updating integration test coverage documentation
confidence: 0.75
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Integration Test Documentation Inventory

## Action
When documenting integration test coverage changes, use coordinated sequence: list test files with Bash, count tests per file, update CLAUDE.md coverage table, then update MEMORY.md total counts.

## Evidence
- Observed 6+ times in coordinated sequence in session 089f503a-9242-463c-8b01-4fa9cbe0f7dd
- Pattern: bash list → bash count per file → edit CLAUDE.md table → read MEMORY.md → edit MEMORY.md totals
- Last observed: 2026-03-14T06:01:12
- Example workflow: discovered 15 test files → counted tests → updated CLAUDE.md with plugin|test count table → updated MEMORY.md from "49 tests across 14 suites" to "63 tests across 15 suites"

## Notes
This maintains the test inventory status document and memory file in sync. The CLAUDE.md table format is: plugin name | test file | test count | status checkmark. Always verify counts with line-number grep before updating documentation.
