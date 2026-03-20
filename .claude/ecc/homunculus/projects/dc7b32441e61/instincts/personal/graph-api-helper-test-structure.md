---
id: graph-api-helper-test-structure
trigger: when writing tests for graph-fetch-dependent helper modules
confidence: 0.8
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Graph API Helper Test Structure

## Action
Test Graph API helpers by mocking the graph-fetch module with vi.mock(), importing functions dynamically, mocking graphFetch with vi.fn(), and verifying that JSON-stringified results can be parsed and their properties validated.

## Evidence
- Observed 8 times across sessions (5 calendar plugin tests + 3 outlook plugin tests)
- Session bbe56a1c-c659-48a9-87ca-5743e8ba37f1 (2026-03-16/17):
  - Calendar helpers: find-free-time.test.ts, get-event.test.ts, update-event.test.ts, list-calendars.test.ts, graph-fetch.test.ts
  - Outlook helpers: list-recent.test.ts, move-email.test.ts, read-email.test.ts
- Pattern: vi.mock("../graph-fetch") → dynamic import → mock graphFetch → test returns JSON string → JSON.parse() result
- All tests: return serialized strings that tests parse with JSON.parse() before verifying properties
- Mocked responses use realistic Graph API structure (mailFolders, messages, value arrays, etc.)
- Last observed: 2026-03-17T03:58:08Z

