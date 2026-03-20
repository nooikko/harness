---
id: plugin-handler-code-inspection-workflow
trigger: when investigating plugin tool implementations or understanding tool data structures and return formats
confidence: 0.7
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Handler Code Inspection Workflow

## Action
When investigating how plugin tools work or what data they return, systematically read the actual tool handler implementation files in `packages/plugins/*/src/` (main plugin files) and `packages/plugins/*/_helpers/` (helper functions) to understand handler logic, data structures, and return formats directly from source code.

## Evidence
- Observed 6 times in session 3db3a930-228b-4cee-8665-92a3648dd54b (2026-03-17 17:24:27–17:24:33Z)
- Pattern: Reading handler implementations from different plugins:
  - `packages/plugins/cron/src/_helpers/list-cron-jobs.ts` (cron job listing)
  - `packages/plugins/time/src/index.ts` (time formatting plugin)
  - `packages/plugins/identity/src/index.ts` (agent identity/memory injection)
  - `packages/plugins/music/src/_helpers/format-search-results.ts` (music search result formatting)
  - `packages/plugins/calendar/src/_helpers/get-event.ts` (calendar event detail retrieval)
  - `packages/plugins/outlook/src/_helpers/read-email.ts` (email reading)
- Context: Investigation of MCP plugin tools for content block rendering compatibility
- Each read reveals JSON return types, data structure, field selections, and formatting logic
- Last observed: 2026-03-17T17:24:33Z

## Notes
This workflow is faster than reading tool definitions in plugin index files—it gives direct insight into what data is actually returned and how it's structured. Useful when understanding tool integration patterns, content rendering options, or data shape compatibility.
