---
id: integration-tests-over-mocks
trigger: when writing or improving plugin test files
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Prefer Integration Tests Over Pure Mock Assertions

## Action
When testing plugin functionality, make real HTTP/WebSocket calls against started servers rather than only asserting mock call counts.

## Evidence
- Observed 3+ times in web plugin test improvements (2026-03-18)
- Pattern: Tests that set up `register() → start()`, then make actual HTTP GET/POST and WebSocket connections to verify behavior
- Examples:
  - Real HTTP GET to `/api/health` instead of just checking logger mocks
  - Real WebSocket client connection to `/ws` to verify broadcaster behavior
  - POST to `/api/chat` with assertions on both broadcast calls AND sendToThread behavior
  - Last observed: 2026-03-18T22:45:56Z in ws-broadcaster test improvements

## When to Apply
- Testing plugin lifecycle (register → start → stop)
- Testing HTTP routes or WebSocket handlers
- Verify both async call chains (broadcast + fire-and-forget paths)
- Skip if testing internal helper functions (keep those unit tests with mocks)

## Notes
- Extract dynamic port from logger output after `start()` using OS-assigned port 0
- Use `vi.waitFor()` or short timeouts for fire-and-forget error handling verification
- Keep mock setup for external deps (Qdrant client, etc.) but test actual plugin behavior
