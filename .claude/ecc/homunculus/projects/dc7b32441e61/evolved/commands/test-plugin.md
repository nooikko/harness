---
name: test-plugin
description: Generate comprehensive tests for a harness plugin — unit tests with mock context, scope isolation, and fixture sync
command: /test-plugin
evolved_from:
  - plugin-context-mock-factory
  - plugin-crud-test-scope-verification
  - prop-type-test-fixture-sync
  - vitest-mock-setup-pattern
  - test-mock-case-augmentation
---

# Test Plugin Command

Generates or updates tests for a harness plugin.

## Usage

```
/test-plugin <plugin-name>           # Generate tests for all handlers
/test-plugin <plugin-name> --handler <name>  # Generate test for specific handler
```

## Steps

1. Read plugin's `src/index.ts` to discover tools and hooks
2. Read each handler in `src/_helpers/` to understand input/output
3. For each handler, generate `src/_helpers/__tests__/<handler>.test.ts`:

   ### Test Structure
   ```typescript
   import { describe, it, expect, vi, beforeEach } from "vitest";

   // Mock prisma
   const mockDb = { model: { findMany: vi.fn(), create: vi.fn(), ... } };
   // Mock context
   const mockCtx = { db: mockDb, logger: { info: vi.fn(), ... }, ... };

   describe("<handler>", () => {
     beforeEach(() => { vi.clearAllMocks(); });
     it("succeeds with valid input", async () => { ... });
     it("rejects invalid input", async () => { ... });
     it("enforces agent scope isolation", async () => { ... });
   });
   ```

4. Verify scope isolation: if handler touches agent-owned data, add test that agent A's data isn't visible to agent B
5. Run `pnpm --filter @harness/plugin-<name> test` to verify
