---
id: tool-result-refactoring
trigger: when updating plugin helper functions to return structured data
confidence: 0.7
domain: code-style
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Tool Result Refactoring Pattern

## Action
Convert plugin helper functions from returning plain strings to returning `ToolResult` objects with structured `blocks` for rich UI rendering.

## Evidence
- Observed 3 times in session 3db3a930-228b-4cee-8665-92a3648dd54b
- Pattern: `Promise<string>` → `Promise<ToolResult>` with text + blocks structure
- Files affected: get-event.ts, format-search-results.ts, find-free-time.ts
- Last observed: 2026-03-17T17:31:29Z

## Pattern Details
When refactoring tool handlers:
1. Import `ToolResult` from `@harness/plugin-contract`
2. Change return type from `string` or `Promise<string>` to `ToolResult` or `Promise<ToolResult>`
3. Wrap JSON.stringify result in `text` property
4. Add `blocks` array with domain-specific block type (calendar-events, music-search, etc.)
5. Pass relevant structured data in block's `data` property (events, results, etc.)

Example: `{ text: jsonString, blocks: [{ type: "domain-specific", data: {...} }] }`
