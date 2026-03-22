---
id: server-action-database-mock-testing
trigger: when writing unit tests for server actions that mutate database
confidence: 0.85
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Server Action Database Mock Testing Pattern

## Action
Mock database methods (findMany, create, delete) with vi.fn(), mock next/cache revalidatePath, test the success case with expected database calls, test the error case when database operations fail, and verify revalidatePath is called on success but not on failure.

## Evidence
- Observed 7+ times across sessions 4856ee0a and bbe56a1c (2026-03-15 to 2026-03-17)
- Pattern in add-task-dependency.test.ts: Mocks findMany + create, tests success path, tests cycle detection error, tests failure case
- Pattern in remove-task-dependency.test.ts: Mocks delete, tests success + failure paths, verifies revalidatePath called on success
- Pattern in task-filters.test.tsx, task-list.test.tsx: Component tests also mock database and router
- OAuth server action tests (session bbe56a1c):
  - ConnectButton: Mocks connectMicrosoft server action imported from _actions/, verifies mock was called
  - DisconnectButton: Mocks disconnectAccount, tests call with provider + accountId params
  - ConnectedAccounts: Mocks prisma.oAuthToken.findMany, tests empty state, token display, scope truncation, metadata fallback
- Consistent structure: Mock setup → beforeEach with clearAllMocks → it() with mockResolvedValue/mockRejectedValue → expect database calls and revalidatePath invocations
- Last observed: 2026-03-17T03:26:46Z

## Why
Server actions in harness follow a specific error handling and side-effect pattern. The tests must verify:
1. Database operations are called with correct parameters
2. Business logic errors (cycles, duplicates) are caught and returned correctly
3. Cache invalidation via revalidatePath happens on success
4. Mock cleanup prevents test pollution
