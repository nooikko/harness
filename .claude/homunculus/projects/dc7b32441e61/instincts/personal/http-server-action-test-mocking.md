---
id: http-server-action-test-mocking
trigger: when writing unit tests for server actions that make HTTP calls
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# HTTP Server Action Test Mocking Pattern

## Action
Mock global fetch with vi.fn(), mock next/cache revalidatePath, mock getOrchestratorUrl helper, then test success case, HTTP error case with fallback error message, and network unreachable case.

## Evidence
- Observed 4 times in session 4856ee0a-a85e-44ce-988d-133f25f77051
- Pattern confirmed in all 4 server action test files: disconnect-account.test.ts, identify-device.test.ts, initiate-oauth.test.ts, set-device-alias.test.ts
- Consistent structure across all files:
  1. `const mockFetch = vi.fn(); global.fetch = mockFetch`
  2. Mock next/cache revalidatePath
  3. Mock @/app/_helpers/get-orchestrator-url
  4. Test "returns success and revalidates on ok response"
  5. Test "returns error on non-ok response" with JSON error body
  6. Test "returns fallback error when response body has no error field"
  7. Test "returns unreachable error when fetch throws"
- 16 tests total created (4 per file), all passing
- Last observed: 2026-03-16T21:21:02Z

## Why
HTTP-based server actions have multiple failure modes (network unreachable, HTTP error, malformed response) that need explicit test coverage. Mocking fetch at the global level isolates tests from network. Testing both happy and error paths ensures the error handling pattern (try/catch, res.ok check, JSON fallback) works correctly.
