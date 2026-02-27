# Pipeline Integration Tests — Design

**Date:** 2026-02-27
**Status:** Approved
**Goal:** Test the full orchestrator pipeline end-to-end — without frontend — including command discovery, hook invocation, plugin side effects, and DB persistence. Covers every active plugin.

---

## Problem Statement

All current tests are unit tests: every dependency is mocked with `vi.fn()`. The orchestrator's `handleMessage` is tested with mocked helpers; each plugin's hooks are called directly with a mock `PluginContext`. There is no test that wires the orchestrator + a plugin together and runs a real message through the pipeline.

**Gap:** No test verifies that:
- A `/delegate` command in Claude's output actually triggers the delegation plugin's `onCommand` handler through the full pipeline
- The context plugin's `onBeforeInvoke` actually reads history from the database and injects it into the prompt
- The metrics plugin's `onAfterInvoke` actually writes a `Metric` row after an invocation
- The activity plugin actually persists pipeline step records to the DB

---

## Constraints

1. **No real Claude invocations** — invoker is always a `vi.fn()` mock returning controlled output
2. **Real Postgres** — SQLite is insufficient (Postgres-specific features like JSON operators, full-text search)
3. **Testcontainers** — Postgres container spun up automatically per test run, no external setup required
4. **Architectural boundary** — integration tests must not create an orchestrator→plugin dependency in source code. Plugins should not import the orchestrator. The test package is the only place that imports both.
5. **One test file per plugin** — focused, discoverable, easy to run in isolation
6. **Separate from unit tests** — integration suite runs independently; pre-commit hook remains fast

---

## Architecture Decision

A new **test-only workspace package** at `tests/integration/` that sits at the top of the dependency graph. It imports from both the orchestrator and each plugin. It is never imported by source code.

```
Dependency graph (simplified):
  plugin-contract ← orchestrator
  plugin-contract ← plugins/*
  orchestrator ← (via plugin-registry in prod, not here)
  tests/integration/ ← orchestrator, plugins/*  [test-only]
```

---

## Package Structure

```
tests/integration/
  package.json                        ← no main, devDependencies only
  tsconfig.json                       ← extends root tsconfig
  vitest.config.ts                    ← globalSetup + testTimeout for containers
  setup/
    global-setup.ts                   ← start/stop PostgreSqlContainer, prisma db push
    reset-db.ts                       ← truncate all tables between tests
  helpers/
    create-harness.ts                 ← createTestHarness(plugin, opts?) factory
  context-plugin.test.ts
  delegation-plugin.test.ts
  metrics-plugin.test.ts
  time-plugin.test.ts
  web-plugin.test.ts
  activity-plugin.test.ts
  discord-plugin.test.ts
```

---

## Global Setup (`setup/global-setup.ts`)

Vitest's `globalSetup` API runs once for the entire suite:

```typescript
// Pseudo-code
export const setup = async () => {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  process.env.TEST_DATABASE_URL = container.getConnectionUri();
  // Apply schema via prisma db push (no migration history needed for tests)
  execSync("pnpm prisma db push --skip-generate", {
    cwd: "packages/database",
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
  return async () => await container.stop();
};
```

`reset-db.ts` provides a `resetDatabase(prisma)` helper called in `beforeEach` of every test file. It issues `TRUNCATE ... CASCADE` on all tables, giving each test a clean slate without restarting the container.

---

## Test Harness (`helpers/create-harness.ts`)

```typescript
type TestHarness = {
  orchestrator: Orchestrator;
  prisma: PrismaClient;
  invoker: { invoke: MockedFunction<Invoker["invoke"]> };
  threadId: string;
  cleanup: () => Promise<void>;
};

const createTestHarness = async (
  plugin: PluginDefinition,
  opts?: { invokerOutput?: string }
): Promise<TestHarness> => {
  const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
  const invoker = { invoke: vi.fn().mockResolvedValue({
    output: opts?.invokerOutput ?? "ok",
    durationMs: 10,
    exitCode: 0,
  }) };

  // Seed a thread (required for handleMessage)
  const thread = await prisma.thread.create({ data: { name: "Test", kind: "primary" } });

  const orchestrator = createOrchestrator({ db: prisma, invoker, config: testConfig, logger });
  await orchestrator.registerPlugin(plugin);
  await orchestrator.start();

  return {
    orchestrator,
    prisma,
    invoker,
    threadId: thread.id,
    cleanup: async () => {
      await orchestrator.stop();
      await prisma.$disconnect();
    },
  };
};
```

Each test:
1. Calls `createTestHarness(plugin)` in `beforeEach`
2. Calls `harness.cleanup()` in `afterEach`
3. Configures `harness.invoker.invoke.mockResolvedValue(...)` for specific scenarios
4. Calls `harness.orchestrator.handleMessage(threadId, "user", "content")`
5. Queries `harness.prisma.*` to assert DB state

---

## Per-Plugin Test Coverage

### context-plugin.test.ts
- `onBeforeInvoke` injects real DB message history into prompt when `sessionId` is null
- `onBeforeInvoke` skips history injection when `sessionId` is set on thread
- Prompt returned from `onBeforeInvoke` contains formatted history section

### delegation-plugin.test.ts
- Invoker returns `/delegate Research X` → `onCommand` fires → thread + task created in DB
- `onCommand` returns `true` for `delegate`, `re-delegate`, `checkin`
- `onCommand` returns `false` for unknown commands
- Empty delegate prompt → returns false, no DB writes
- `checkin` with valid parent thread → `sendToThread` called on parent

### metrics-plugin.test.ts
- `onAfterInvoke` writes a `Metric` row with correct token counts
- `Metric.inputTokens`, `outputTokens`, `durationMs`, `model`, `threadId` all correct
- No metric written if invoker returns zero tokens

### time-plugin.test.ts
- `onBeforeInvoke` replaces `/current-time` in prompt with formatted timestamp
- Timezone from config is used
- Prompt without `/current-time` passes through unchanged

### activity-plugin.test.ts
- Pipeline start record written to DB before invoke
- Pipeline step records written (onMessage, onBeforeInvoke, invoking, onAfterInvoke)
- Pipeline complete record written after pipeline finishes
- Stream events (thinking, tool_call, tool_result) persisted from invoker callback

### web-plugin.test.ts
- HTTP server starts on configured port
- `POST /api/chat` returns 200 and triggers pipeline execution
- WebSocket clients receive `pipeline:step` events during pipeline run
- `POST /api/prewarm` calls `invoker.prewarm()`

### discord-plugin.test.ts
- Plugin registers and starts without crashing when `discordToken` is undefined
- Settings schema validates correctly
- Message adapter correctly maps content/author to expected format
- `should-process-message` respects bot message filtering

---

## Turbo Integration

Add `test:integration` to `turbo.json`:

```json
{
  "tasks": {
    "test:integration": {
      "dependsOn": ["^build"],
      "cache": false
    }
  }
}
```

Add to root `package.json`:

```json
{
  "scripts": {
    "test:integration": "turbo test:integration"
  }
}
```

The integration suite is **not** part of `pnpm test` (unit tests) and **not** part of the pre-commit hook. It runs as a separate CI step after unit tests pass.

---

## Dependencies

New packages required in `tests/integration/package.json`:

- `@testcontainers/postgresql` — Postgres testcontainer
- `testcontainers` — base testcontainer library
- `vitest` — test runner
- `database` (workspace) — Prisma client
- `@harness/plugin-contract` (workspace) — types
- `apps/orchestrator` (workspace) — `createOrchestrator`
- `@harness/plugin-context` (workspace)
- `@harness/plugin-delegation` (workspace)
- `@harness/plugin-metrics` (workspace)
- `@harness/plugin-time` (workspace)
- `@harness/plugin-web` (workspace)
- `@harness/plugin-activity` (workspace)
- `@harness/plugin-discord` (workspace)

---

## What This Does NOT Test

- Frontend (Next.js pages, server actions) — out of scope
- Real Claude invocations — invoker is always mocked
- Discord gateway (live Discord connection) — discord plugin test is partial
- Performance / load testing — not the goal here
