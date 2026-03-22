---
id: test-failure-driven-mock-completion
trigger: when vitest test fails with error about calling unmocked method
confidence: 0.75
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Test Failure-Driven Mock Completion

## Action
When a Vitest test fails because a mocked dependency method hasn't been defined, add the missing method to the vi.mock() definition (e.g., `findUnique: vi.fn()`), then add the mock setup to beforeEach using `vi.mocked(module.method).mockResolvedValue()`, then immediately re-run tests to verify the fix.

## Evidence
- Observed 4 times in initial Edit operations (2026-03-15 session 4856ee0a)
- Additional pattern observed: when mock data structure doesn't match expected type signature, use `as never` type assertion to bypass TypeScript type checking (observed 3+ times in subsequent Edits at 22:56:45, 22:57:06, 22:57:12)
- Progression: unmocked method error → add to vi.mock() → TypeScript type mismatch → add `as never` → comprehensive test coverage
- Pattern applies to Prisma mocks and helper function mocks
- Common with incomplete mock objects that have fewer fields than the full type definition
- Cycle: runtime failure → add missing method → compile error → add `as never` → re-run passes
- Test files: src/app/api/search/__tests__/route.test.ts (all failures resolved, 1161 tests passing)
- Last observed: 2026-03-15T22:57:12Z

## Related Instincts
- vitest-mock-setup-pattern: covers general mock structure
- vitest-extensive-dependency-mocking: covers comprehensive mocking strategy
