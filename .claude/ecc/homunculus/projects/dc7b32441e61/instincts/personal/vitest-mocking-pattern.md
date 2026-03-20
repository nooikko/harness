---
id: vitest-mocking-pattern
trigger: when writing unit tests for server actions or API integrations
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Vitest Mocking Pattern for External Dependencies

## Action
Use `vi.mock()` with explicit dependency mocks before imports, include `beforeEach` cleanup, and test both success and error paths including auth/API failures.

## Evidence
- Observed 3 times in session eb5a3960-663f-428c-81b0-90c58809f930
- Pattern: Create test files with `vi.mock('@harness/database')`, `vi.mock('@harness/oauth')`, `vi.mock('next/cache')` at top, assign `global.fetch = vi.fn()` before imports
- Tests include: validation failures (empty fields), success cases with mocked returns, API error responses (non-200 status), OAuth token failures
- Last observed: 2026-03-19 18:59:31

Rules:
- Mock external dependencies before imports with specific vi.mock() paths
- Include beforeEach(() => { vi.clearAllMocks() }) for test isolation
- Test error cases: validation errors, API failures (with status codes), auth token issues
- Use mockResolvedValue() and mockRejectedValue() for async mocks
- Verify mocked function calls with expect().toHaveBeenCalledWith() including auth headers
