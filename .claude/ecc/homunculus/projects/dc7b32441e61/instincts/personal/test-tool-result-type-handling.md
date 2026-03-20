---
id: test-tool-result-type-handling
trigger: when parsing tool handler results in plugin integration tests
confidence: 0.5
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test Tool Result Type Handling

## Action
When parsing tool handler results in tests, always handle the union type where results can be either a string or an object with a `.text` property using: `const text = typeof result === 'string' ? result : result.text;` before JSON parsing.

## Evidence
- Observed 3 times in session fb82d648-d365-4942-974d-2a480cdd8639 (2026-03-17 17:45:45–17:45:59Z)
- Pattern: Applied identical fix across multiple test files:
  - `tests/integration/calendar-plugin.test.ts` (list_events test)
  - `tests/integration/outlook-plugin.test.ts` (search_emails test)
  - `tests/integration/outlook-plugin.test.ts` (find_unsubscribe_links test)
- Context: Tool handlers return results that need parsing; sometimes results are plain strings, sometimes wrapped in objects
- Last observed: 2026-03-17T17:45:59Z

## Notes
Plugin tool handlers have inconsistent return types. Tests that parse results as JSON must normalize the result type first. This prevents "JSON.parse of undefined" errors when results are wrapped in `{ text: "..." }` objects versus plain string returns.
