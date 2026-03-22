---
id: comprehensive-test-coverage
trigger: when writing unit tests for new functions or components
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Comprehensive Test Coverage Pattern

## Action
Write multiple test cases for each function covering: happy path, error cases, edge cases with different parameters, and optional field handling.

## Evidence
- Observed 10+ times across sessions 4856ee0a and bbe56a1c
- Pattern: Each test file includes 3-4+ test cases per function
  - Success case (mockResolvedValue)
  - Error/failure case (mockRejectedValue)
  - Parameter variation cases (optional fields, different inputs)
  - Type verification cases (correct payload structure)
- Examples: create-task tests (3 cases + 2 new), search-points tests (3 cases), upsert-point tests (2 cases)
- OAuth component tests (session bbe56a1c):
  - ConnectButton: renders + calls action on click (2 cases)
  - DisconnectButton: renders + calls action with params (2 cases)
  - ConnectedAccounts: empty state + multiple accounts + scope truncation + fallback to accountId (4 cases)
  - OAuthStatusMessage: error message + success message + no message (3 cases)
- Last observed: 2026-03-17T03:26:46Z

## Implementation Details
- Test happy path first (basic usage)
- Add failure case with mockRejectedValue
- Test parameter combinations and optional fields
- Verify side effects (revalidatePath calls, cache updates)
- Test return value structure and types
