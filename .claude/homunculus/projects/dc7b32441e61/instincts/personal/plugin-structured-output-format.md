---
id: plugin-structured-output-format
trigger: when updating plugin helper functions that return formatted output for display
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Plugin Helpers Return Structured Output Format

## Action
Update plugin helper functions to return structured format with `text` and `blocks` fields instead of plain strings, and extract formatting logic into reusable helper modules.

## Pattern
Plugin helper functions (like `readEmail`, `listTasks`, `listEvents`, queue state formatting) should return:
```
{ text: string; blocks: Array<{ type: string; data: Record<string, unknown> }> }
```

The `text` field contains the human-readable output, while `blocks` contains structured data for programmatic access.

## Evidence
- Observed 5+ times in session 3db3a930-228b-4cee-8665-92a3648dd54b
- Pattern applied to: outlook (read-email), tasks (list-tasks), calendar (list-events), music (queue state)
- Tests updated to assert on both `structured.text` (string content) and `structured.blocks[n]` (structured data)
- Format helpers extracted into dedicated modules (`formatQueueState`, etc.) and imported instead of inline logic
- Last observed: 2026-03-17

## When to Apply
- When updating any plugin helper that returns formatted output (list operations, detail views, state displays)
- Extract formatting logic into helper modules for reuse across tools
- Update tests to verify both text and blocks structure
