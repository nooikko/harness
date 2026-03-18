---
paths:
  - "tests/integration/**"
  - "tests/integration/**/*.test.ts"
  - "packages/plugins/**/__tests__/**"
  - "packages/plugins/**/vitest.config.ts"
---

# Integration Testing Patterns

Learned conventions for writing integration tests in the harness monorepo. These patterns cover the testcontainers-based test infrastructure.

---

## Test Harness Factory

Use `createTestHarness(plugin, opts?)` to bootstrap orchestrator + database for integration tests:

```typescript
const harness = await createTestHarness(myPlugin, {
  invokerOutput: "mocked response",
  invokerModel: "claude-haiku-4-5-20251001",
  invokerTokens: { input: 100, output: 50 },
  port: 4099, // for web plugin tests
});
```

Returns `{ orchestrator, prisma, invoker, threadId, cleanup }`. The factory handles orchestrator registration, plugin start, thread creation, and mock invoker setup.

---

## Database Reset

Every integration test must reset state in `beforeEach`:

```typescript
beforeEach(async () => {
  await resetDatabase(prisma);
});
```

This runs `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` for all tables. Prevents test pollution where one test's state affects the next.

---

## Async Assertions

Use `vi.waitFor()` for assertions on async DB state changes — never `setTimeout`:

```typescript
await vi.waitFor(
  async () => {
    const job = await prisma.cronJob.findFirst({ where: { name: "test" } });
    expect(job?.nextRunAt).not.toBeNull();
  },
  { timeout: 10_000 },
);
```

This polls until the assertion succeeds or times out. Required for fire-and-forget hooks that write to DB asynchronously.

---

## Fire-and-Forget Hook Assertions

Never assert exact `invoke` call counts in multi-plugin integration tests. Fire-and-forget hooks (`void scoreAndWriteMemory(...)`, auto-namer, etc.) register additional calls after the pipeline returns.

```typescript
// Wrong — breaks when fire-and-forget hooks add calls
expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);

// Correct — verify the call happened, inspect content
expect(harness.invoker.invoke).toHaveBeenCalled();
const pipelinePrompt = harness.invoker.invoke.mock.calls[0]![0] as string;

// Correct — verify side effects independently
const job = await prisma.cronJob.findFirst({ ... });
expect(job?.nextRunAt).not.toBeNull();
```

---

## PluginContext Mock Factory

For unit tests of plugin helpers, use a reusable mock factory:

```typescript
const createMockCtx = (overrides?: Partial<PluginContext>) =>
  ({
    db: { pluginConfig: { findUnique: vi.fn(), upsert: vi.fn() } },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    notifySettingsChange: vi.fn(),
    ...overrides,
  }) as unknown as PluginContext;
```

Override only what a specific test needs. Use `as never` to suppress type errors for partial mocks.

---

## Multi-Plugin Test Gap

Individual plugin tests use `createTestHarness(onePlugin)` — single-plugin isolation. Plugin interactions (identity -> context prompt chain, hook ordering) are only verified in the full-pipeline integration test. When adding cross-plugin behavior, verify it in the full-pipeline test, not just individual plugin tests.

---

## Scoping Failures

When multiple resource-listing tools fail across different plugins with project scoping errors, investigate the shared scoping/filtering logic — not individual tool implementations. Common root cause: `projectId`/`agentId` not being passed through scope resolution.

---

## Biome in Tests

Integration test files may accumulate `useLiteralKeys` violations (bracket vs dot notation). Run `pnpm check` to auto-fix. These are cosmetic and don't affect test behavior.
