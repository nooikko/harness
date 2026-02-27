# Pipeline Integration Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `tests/integration/` workspace package that runs one integration test suite per plugin, wiring the real orchestrator + real plugin + real Postgres (via testcontainers) + mock invoker.

**Architecture:** A separate pnpm workspace package (`tests/integration/`) sits at the top of the dependency graph — it imports from both `orchestrator` and each plugin package without creating circular dependencies. A single Postgres testcontainer starts once per test run via Vitest's `globalSetup`. A `createTestHarness(plugin)` helper creates the orchestrator, registers the plugin, seeds a thread, and exposes the mock invoker for per-test configuration. Each test queries the real Prisma client to assert DB side effects.

**Tech Stack:** Vitest 4, testcontainers `@testcontainers/postgresql`, Prisma 6, pnpm workspaces, TypeScript. No new source packages — this is test-only.

**Design doc:** `docs/plans/pipeline-integration-tests-design.md`

---

## Task 1: Export `createOrchestrator` from orchestrator's public API

The `tests/integration` package needs to import `createOrchestrator` from the `orchestrator` workspace package. Currently it's only exported from the internal `src/orchestrator/index.ts`. We re-export it from the package's main entry point.

**Files:**
- Modify: `apps/orchestrator/src/index.ts`

**Step 1: Add the re-export**

At the bottom of `apps/orchestrator/src/index.ts`, after the existing `boot` and `main` exports, add:

```typescript
export { createOrchestrator } from './orchestrator';
export type { OrchestratorDeps, HandleMessageResult } from './orchestrator';
```

**Step 2: Verify TypeScript accepts it**

```bash
pnpm --filter orchestrator typecheck
```

Expected: passes with no errors.

**Step 3: Commit**

```bash
git add apps/orchestrator/src/index.ts
git commit -m "feat(orchestrator): export createOrchestrator and types from package entry point"
```

---

## Task 2: Scaffold the `tests/integration` workspace package

Create the package skeleton and wire it into pnpm's workspace.

**Files:**
- Create: `tests/integration/package.json`
- Create: `tests/integration/tsconfig.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `turbo.json`
- Modify: `package.json` (root)

**Step 1: Create `tests/integration/package.json`**

```json
{
  "name": "integration-tests",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "test:integration": "vitest run",
    "test:integration:watch": "vitest"
  },
  "devDependencies": {
    "@harness/logger": "workspace:*",
    "@harness/plugin-activity": "workspace:*",
    "@harness/plugin-context": "workspace:*",
    "@harness/plugin-contract": "workspace:*",
    "@harness/plugin-delegation": "workspace:*",
    "@harness/plugin-discord": "workspace:*",
    "@harness/plugin-metrics": "workspace:*",
    "@harness/plugin-time": "workspace:*",
    "@harness/plugin-web": "workspace:*",
    "@testcontainers/postgresql": "^10.24.2",
    "@vitest/coverage-v8": "^4.0.18",
    "database": "workspace:*",
    "orchestrator": "workspace:*",
    "testcontainers": "^10.24.2",
    "vite-tsconfig-paths": "^6.1.1",
    "vitest": "^4.0.18"
  }
}
```

**Step 2: Create `tests/integration/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "./dist",
    "baseUrl": "."
  },
  "include": ["**/*.ts"]
}
```

Note: `../../tsconfig.json` assumes `tests/integration/` is two levels below repo root. Verify that a root `tsconfig.json` exists — if not, use the orchestrator's tsconfig as the base.

**Step 3: Update `pnpm-workspace.yaml`**

Add `tests/*` to the packages list:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'packages/plugins/*'
  - 'tests/*'

onlyBuiltDependencies:
  - '@biomejs/biome'
```

**Step 4: Add `test:integration` to `turbo.json`**

Add to the `tasks` object:

```json
"test:integration": {
  "dependsOn": ["^build"],
  "cache": false
}
```

**Step 5: Add `test:integration` script to root `package.json`**

In the `scripts` object:

```json
"test:integration": "turbo test:integration"
```

**Step 6: Install dependencies**

```bash
pnpm install
```

Expected: resolves without errors. The `integration-tests` package appears in `pnpm list`.

**Step 7: Commit the scaffold**

```bash
git add tests/integration/package.json tests/integration/tsconfig.json pnpm-workspace.yaml turbo.json package.json pnpm-lock.yaml
git commit -m "feat(tests): scaffold tests/integration workspace package"
```

---

## Task 3: Create Vitest config and global test setup

The global setup starts one Postgres container for the entire test run. The `reset-db.ts` helper truncates all tables between individual tests.

**Files:**
- Create: `tests/integration/vitest.config.ts`
- Create: `tests/integration/setup/global-setup.ts`
- Create: `tests/integration/setup/reset-db.ts`

**Step 1: Create `tests/integration/vitest.config.ts`**

```typescript
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: 'integration',
    environment: 'node',
    globalSetup: './setup/global-setup.ts',
    testTimeout: 90_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
```

`fileParallelism: false` runs test files sequentially — important since they all share one container and truncate tables in `beforeEach`.

**Step 2: Create `tests/integration/setup/global-setup.ts`**

```typescript
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;

export const setup = async (): Promise<() => Promise<void>> => {
  console.log('[integration] Starting Postgres testcontainer...');
  container = await new PostgreSqlContainer('postgres:16-alpine').start();

  const dbUrl = container.getConnectionUri();
  process.env.TEST_DATABASE_URL = dbUrl;

  console.log('[integration] Pushing Prisma schema...');
  const dbPackageDir = resolve(process.cwd(), '../../packages/database');
  execSync('pnpm prisma db push --skip-generate --accept-data-loss', {
    cwd: dbPackageDir,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
  });

  console.log('[integration] Test database ready.');

  return async () => {
    console.log('[integration] Stopping testcontainer...');
    await container.stop();
  };
};
```

Note: `process.cwd()` in Vitest `globalSetup` is the package directory (`tests/integration/`). The `../../packages/database` path resolves to the Prisma schema location. Verify with `path.resolve` before relying on this.

**Step 3: Create `tests/integration/setup/reset-db.ts`**

```typescript
import type { PrismaClient } from 'database';

export const resetDatabase = async (prisma: PrismaClient): Promise<void> => {
  // Truncate in reverse dependency order to avoid FK violations.
  // RESTART IDENTITY resets auto-increment sequences.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Message",
      "OrchestratorTask",
      "AgentRun",
      "CronJob",
      "Metric",
      "PluginConfig",
      "Thread"
    RESTART IDENTITY CASCADE
  `);
};
```

**Step 4: Verify the global setup file can be parsed by TypeScript**

```bash
pnpm --filter integration-tests typecheck 2>&1 | head -20
```

At this point you have no test files, so typecheck will succeed or report only "no input files". Either is acceptable.

**Step 5: Commit**

```bash
git add tests/integration/vitest.config.ts tests/integration/setup/global-setup.ts tests/integration/setup/reset-db.ts
git commit -m "feat(tests): add vitest config, testcontainer global setup, and reset-db helper"
```

---

## Task 4: Create the `createTestHarness` helper

This is the central factory used by every integration test. It wires the real orchestrator with a single plugin, a real PrismaClient (test DB), a mock invoker, and a pre-seeded thread.

**Files:**
- Create: `tests/integration/helpers/create-harness.ts`

**Step 1: Create `tests/integration/helpers/create-harness.ts`**

```typescript
import { createLogger } from '@harness/logger';
import type { Invoker, OrchestratorConfig, PluginDefinition } from '@harness/plugin-contract';
import { PrismaClient } from 'database';
import { createOrchestrator } from 'orchestrator';
import { vi } from 'vitest';

export type TestHarness = {
  orchestrator: ReturnType<typeof createOrchestrator>;
  prisma: PrismaClient;
  invoker: { invoke: ReturnType<typeof vi.fn> };
  threadId: string;
  cleanup: () => Promise<void>;
};

const testConfig: OrchestratorConfig = {
  databaseUrl: process.env.TEST_DATABASE_URL ?? '',
  timezone: 'UTC',
  maxConcurrentAgents: 3,
  claudeModel: 'claude-haiku-4-5-20251001',
  claudeTimeout: 10_000,
  discordToken: undefined,
  discordChannelId: undefined,
  port: 0,
  logLevel: 'error',
};

export const createTestHarness = async (
  plugin: PluginDefinition,
  opts?: {
    invokerOutput?: string;
    invokerModel?: string;
    invokerTokens?: { inputTokens: number; outputTokens: number };
    port?: number;
  },
): Promise<TestHarness> => {
  const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
  await prisma.$connect();

  const invoker = {
    invoke: vi.fn().mockResolvedValue({
      output: opts?.invokerOutput ?? 'ok',
      durationMs: 10,
      exitCode: 0,
      model: opts?.invokerModel ?? 'claude-haiku-4-5-20251001',
      inputTokens: opts?.invokerTokens?.inputTokens ?? 100,
      outputTokens: opts?.invokerTokens?.outputTokens ?? 50,
      sessionId: undefined,
    }),
  } as unknown as { invoke: ReturnType<typeof vi.fn> } & Invoker;

  const logger = createLogger('test');
  const config = opts?.port ? { ...testConfig, port: opts.port } : testConfig;

  const orchestrator = createOrchestrator({
    db: prisma,
    invoker: invoker as Invoker,
    config,
    logger,
  });

  await orchestrator.registerPlugin(plugin);
  await orchestrator.start();

  const thread = await prisma.thread.create({
    data: { name: 'Integration Test Thread', kind: 'primary' },
  });

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

**Step 2: Typecheck**

```bash
pnpm --filter integration-tests typecheck 2>&1 | head -30
```

Expected: any remaining errors are about missing `@harness/logger`'s `createLogger` signature. Fix import if needed.

**Step 3: Commit**

```bash
git add tests/integration/helpers/create-harness.ts
git commit -m "feat(tests): add createTestHarness factory for integration tests"
```

---

## Task 5: metrics plugin integration test

Start here because it's the simplest plugin to test: `onAfterInvoke` writes one DB row. No commands, no prompt transformation — just a clear before/after.

**Files:**
- Create: `tests/integration/metrics-plugin.test.ts`

**Step 1: Write the test**

```typescript
import { plugin as metricsPlugin } from '@harness/plugin-metrics';
import { PrismaClient } from 'database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('metrics plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness.cleanup();
  });

  it('writes a Metric row after a successful invocation', async () => {
    harness = await createTestHarness(metricsPlugin, {
      invokerModel: 'claude-haiku-4-5-20251001',
      invokerTokens: { inputTokens: 200, outputTokens: 75 },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    const metrics = await harness.prisma.metric.findMany();
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      threadId: harness.threadId,
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 200,
      outputTokens: 75,
    });
    expect(metrics[0]!.costEstimate).toBeGreaterThan(0);
    expect(metrics[0]!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('does not write a Metric row when invoker returns no model', async () => {
    harness = await createTestHarness(metricsPlugin);
    harness.invoker.invoke.mockResolvedValue({
      output: 'ok',
      durationMs: 10,
      exitCode: 0,
      model: undefined,
      inputTokens: 100,
      outputTokens: 50,
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    const metrics = await harness.prisma.metric.findMany();
    expect(metrics).toHaveLength(0);
  });

  it('does not write a Metric row when invoker returns no tokens', async () => {
    harness = await createTestHarness(metricsPlugin);
    harness.invoker.invoke.mockResolvedValue({
      output: 'ok',
      durationMs: 10,
      exitCode: 0,
      model: 'claude-haiku-4-5-20251001',
      inputTokens: undefined,
      outputTokens: undefined,
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    const metrics = await harness.prisma.metric.findMany();
    expect(metrics).toHaveLength(0);
  });
});
```

**Step 2: Run the test**

```bash
pnpm --filter integration-tests test:integration 2>&1 | tail -30
```

Expected: The container starts (~5s), schema is pushed, then the tests pass.

If the test fails with a DB error, check:
- `process.env.TEST_DATABASE_URL` is set in the Vitest worker process (global setup sets it on `process.env`, which is visible in workers)
- The `Metric` table exists (Prisma schema was pushed correctly)

**Step 3: Commit**

```bash
git add tests/integration/metrics-plugin.test.ts
git commit -m "test(integration): add metrics plugin integration test — Metric row persistence"
```

---

## Task 6: time plugin integration test

The time plugin transforms the prompt in `onBeforeInvoke`. We capture the prompt by inspecting what `invoker.invoke` was called with.

**Files:**
- Create: `tests/integration/time-plugin.test.ts`

**Step 1: Write the test**

```typescript
import { plugin as timePlugin } from '@harness/plugin-time';
import { PrismaClient } from 'database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('time plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness.cleanup();
  });

  it('replaces /current-time token in the assembled prompt', async () => {
    harness = await createTestHarness(timePlugin);

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'The time is /current-time right now');

    // The invoker receives the final prompt after all onBeforeInvoke hooks
    const invokeCall = harness.invoker.invoke.mock.calls[0];
    const promptArg = invokeCall![0] as string;

    expect(promptArg).not.toContain('/current-time');
    // Should be replaced with a real timestamp string
    expect(promptArg).toMatch(/\d{4}/); // year present
  });

  it('passes through prompts without /current-time unchanged', async () => {
    harness = await createTestHarness(timePlugin);

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Hello, no time token here');

    const invokeCall = harness.invoker.invoke.mock.calls[0];
    const promptArg = invokeCall![0] as string;

    expect(promptArg).toContain('Hello, no time token here');
  });
});
```

**Step 2: Run**

```bash
pnpm --filter integration-tests test:integration 2>&1 | tail -20
```

Expected: both tests pass.

**Step 3: Commit**

```bash
git add tests/integration/time-plugin.test.ts
git commit -m "test(integration): add time plugin integration test — /current-time prompt replacement"
```

---

## Task 7: context plugin integration test

The context plugin reads DB history and injects it into the prompt. We seed messages, then verify the assembled prompt (captured via `invoker.invoke`) contains the history section.

**Files:**
- Create: `tests/integration/context-plugin.test.ts`

**Step 1: Write the test**

```typescript
import { createContextPlugin } from '@harness/plugin-context';
import { PrismaClient } from 'database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('context plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness.cleanup();
  });

  it('injects conversation history into the prompt when sessionId is null', async () => {
    // Use createContextPlugin with no contextDir so it doesn't try to read files
    harness = await createTestHarness(createContextPlugin({ contextDir: '/tmp/nonexistent-context-dir' }));

    // Seed some history messages for the thread
    await harness.prisma.message.createMany({
      data: [
        { threadId: harness.threadId, role: 'user', content: 'What is the capital of France?', kind: 'text', source: 'builtin' },
        { threadId: harness.threadId, role: 'assistant', content: 'The capital of France is Paris.', kind: 'text', source: 'builtin' },
      ],
    });

    // Thread has no sessionId (null by default from seed)
    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Tell me more');

    const invokeCall = harness.invoker.invoke.mock.calls[0];
    const promptArg = invokeCall![0] as string;

    expect(promptArg).toContain('What is the capital of France?');
    expect(promptArg).toContain('The capital of France is Paris.');
    expect(promptArg).toContain('Conversation History');
  });

  it('skips history injection when thread has a sessionId', async () => {
    harness = await createTestHarness(createContextPlugin({ contextDir: '/tmp/nonexistent-context-dir' }));

    // Seed history
    await harness.prisma.message.createMany({
      data: [
        { threadId: harness.threadId, role: 'user', content: 'Secret message', kind: 'text', source: 'builtin' },
      ],
    });

    // Set sessionId on the thread — context plugin skips history in this case
    await harness.prisma.thread.update({
      where: { id: harness.threadId },
      data: { sessionId: 'existing-session-123' },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'New message');

    const invokeCall = harness.invoker.invoke.mock.calls[0];
    const promptArg = invokeCall![0] as string;

    expect(promptArg).not.toContain('Secret message');
  });
});
```

**Step 2: Run**

```bash
pnpm --filter integration-tests test:integration 2>&1 | tail -20
```

Expected: tests pass. The context plugin successfully reads from the real DB.

**Step 3: Commit**

```bash
git add tests/integration/context-plugin.test.ts
git commit -m "test(integration): add context plugin integration test — history injection from real DB"
```

---

## Task 8: delegation plugin integration test

The delegation plugin handles `/delegate` commands fire-and-forget. We verify DB side effects using `vi.waitFor`.

**Files:**
- Create: `tests/integration/delegation-plugin.test.ts`

**Step 1: Understand the flow**

When `handleMessage` receives output containing `/delegate Research X`:
1. `parseCommands` extracts `{ command: 'delegate', args: 'Research X' }`
2. `runCommandHooks` calls `onCommand('thread-id', 'delegate', 'Research X')`
3. The delegation plugin's `onCommand` fires, returns `true` immediately (fire-and-forget)
4. In the background, `startDelegation` creates a task thread and task record in the DB

We need to use `vi.waitFor` to wait for the background operation.

**Step 2: Write the test**

```typescript
import { plugin as delegationPlugin } from '@harness/plugin-delegation';
import { PrismaClient } from 'database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('delegation plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness.cleanup();
  });

  it('creates a task thread and OrchestratorTask record when /delegate appears in output', async () => {
    harness = await createTestHarness(delegationPlugin, {
      invokerOutput: 'I will delegate this.\n/delegate Research the history of Rome',
    });

    // First invoke returns the /delegate command
    // Second invoke (the sub-agent) returns a result
    harness.invoker.invoke
      .mockResolvedValueOnce({
        output: 'I will delegate this.\n/delegate Research the history of Rome',
        durationMs: 10,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 100,
        outputTokens: 50,
        sessionId: undefined,
      })
      .mockResolvedValue({
        output: 'Rome was founded in 753 BC.',
        durationMs: 200,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 200,
        outputTokens: 100,
        sessionId: undefined,
      });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Research Rome');

    // Wait for the fire-and-forget background delegation to create DB records
    await vi.waitFor(
      async () => {
        const tasks = await harness.prisma.orchestratorTask.findMany();
        expect(tasks).toHaveLength(1);
      },
      { timeout: 15_000 },
    );

    const tasks = await harness.prisma.orchestratorTask.findMany();
    expect(tasks[0]).toMatchObject({
      parentThreadId: harness.threadId,
      status: expect.stringMatching(/complete|pending|running/),
    });

    // A task thread was created
    const threads = await harness.prisma.thread.findMany({ where: { parentThreadId: harness.threadId } });
    expect(threads).toHaveLength(1);
  });

  it('does not create a task record for an unhandled command', async () => {
    harness = await createTestHarness(delegationPlugin, {
      invokerOutput: '/unknown-command some args',
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'go');

    // Give background work time to settle
    await new Promise((r) => setTimeout(r, 500));

    const tasks = await harness.prisma.orchestratorTask.findMany();
    expect(tasks).toHaveLength(0);
  });

  it('does not create a task record when delegate args are empty', async () => {
    harness = await createTestHarness(delegationPlugin, {
      invokerOutput: '/delegate   ',
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'go');

    await new Promise((r) => setTimeout(r, 500));

    const tasks = await harness.prisma.orchestratorTask.findMany();
    expect(tasks).toHaveLength(0);
  });
});
```

**Step 3: Run**

```bash
pnpm --filter integration-tests test:integration 2>&1 | tail -30
```

Expected: tests pass. Note that the delegation loop spawns a sub-invoke, so the invoker mock needs to handle multiple calls.

**Step 4: Commit**

```bash
git add tests/integration/delegation-plugin.test.ts
git commit -m "test(integration): add delegation plugin integration test — task creation via /delegate command"
```

---

## Task 9: activity plugin integration test

The activity plugin writes pipeline step records and stream events to the DB via `onPipelineStart` and `onPipelineComplete` hooks.

**Files:**
- Create: `tests/integration/activity-plugin.test.ts`

**Step 1: Write the test**

```typescript
import { plugin as activityPlugin } from '@harness/plugin-activity';
import { PrismaClient } from 'database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('activity plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness.cleanup();
  });

  it('persists a pipeline_start status message at the beginning of the pipeline', async () => {
    harness = await createTestHarness(activityPlugin);

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    const startMessages = await harness.prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'status', source: 'pipeline' },
    });

    const pipelineStart = startMessages.find((m) => {
      const meta = m.metadata as Record<string, unknown> | null;
      return meta?.event === 'pipeline_start';
    });
    expect(pipelineStart).toBeDefined();
  });

  it('persists pipeline step messages for each pipeline step', async () => {
    harness = await createTestHarness(activityPlugin);

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    const stepMessages = await harness.prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'pipeline_step' },
    });

    // Should have at minimum: onMessage, onBeforeInvoke, invoking, onAfterInvoke
    expect(stepMessages.length).toBeGreaterThanOrEqual(4);

    const stepNames = stepMessages.map((m) => {
      const meta = m.metadata as Record<string, unknown> | null;
      return meta?.step;
    });
    expect(stepNames).toContain('onMessage');
    expect(stepNames).toContain('onBeforeInvoke');
    expect(stepNames).toContain('invoking');
    expect(stepNames).toContain('onAfterInvoke');
  });

  it('persists a pipeline_complete status message after the pipeline finishes', async () => {
    harness = await createTestHarness(activityPlugin);

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    const messages = await harness.prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'status' },
    });

    const completeMsg = messages.find((m) => {
      const meta = m.metadata as Record<string, unknown> | null;
      return meta?.event === 'pipeline_complete';
    });
    expect(completeMsg).toBeDefined();
  });

  it('persists thinking stream events when invoker emits them via onMessage callback', async () => {
    harness = await createTestHarness(activityPlugin);

    // Mock invoker to emit a thinking event via the onMessage callback
    harness.invoker.invoke.mockImplementation(async (_prompt: string, opts?: { onMessage?: (event: unknown) => void }) => {
      opts?.onMessage?.({
        type: 'thinking',
        thinking: 'Let me reason about this...',
        id: 'thinking-1',
      });
      return {
        output: 'ok',
        durationMs: 10,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 100,
        outputTokens: 50,
        sessionId: undefined,
      };
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'think about this');

    const thinkingMessages = await harness.prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'thinking' },
    });

    expect(thinkingMessages).toHaveLength(1);
    expect(thinkingMessages[0]!.content).toContain('Let me reason about this...');
  });
});
```

**Step 2: Run**

```bash
pnpm --filter integration-tests test:integration 2>&1 | tail -30
```

Expected: tests pass. Check that the `metadata` JSON column queries work correctly.

**Step 3: Commit**

```bash
git add tests/integration/activity-plugin.test.ts
git commit -m "test(integration): add activity plugin integration test — pipeline step/event DB persistence"
```

---

## Task 10: web plugin integration test

The web plugin starts an HTTP server and broadcasts over WebSocket. These tests require a free port per test run. We use `port: 0` and `server.address().port` to get the assigned port.

**Files:**
- Create: `tests/integration/web-plugin.test.ts`

**Step 1: Write the test**

```typescript
import { plugin as webPlugin } from '@harness/plugin-web';
import { PrismaClient } from 'database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('web plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness.cleanup();
  });

  it('starts the HTTP server and responds to GET /health', async () => {
    // Use a random free port to avoid conflicts between tests
    harness = await createTestHarness(webPlugin, { port: 14_500 });

    const response = await fetch('http://localhost:14500/health');

    expect(response.status).toBe(200);
  });

  it('POST /api/chat accepts a request and returns 200', async () => {
    harness = await createTestHarness(webPlugin, { port: 14_501 });

    // Seed a thread to match the threadId we'll POST
    const response = await fetch('http://localhost:14501/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: harness.threadId, content: 'hello' }),
    });

    expect(response.status).toBe(200);
  });

  it('POST /api/chat is fire-and-forget — invoke is called asynchronously', async () => {
    harness = await createTestHarness(webPlugin, { port: 14_502 });

    const response = await fetch('http://localhost:14502/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: harness.threadId, content: 'trigger pipeline' }),
    });

    expect(response.status).toBe(200);

    // Wait for the fire-and-forget pipeline to complete
    await vi.waitFor(
      () => {
        expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);
      },
      { timeout: 10_000 },
    );
  });
});
```

Note: The web plugin may not have a `/health` route — verify by reading `packages/plugins/web/src/_helpers/routes.ts` before assuming the route exists. Adjust the test if the route is different.

**Step 2: Run**

```bash
pnpm --filter integration-tests test:integration 2>&1 | tail -30
```

Expected: HTTP server starts, responds, tests pass.

**Step 3: Commit**

```bash
git add tests/integration/web-plugin.test.ts
git commit -m "test(integration): add web plugin integration test — HTTP server and fire-and-forget pipeline"
```

---

## Task 11: discord plugin integration test

The Discord plugin starts a gateway connection that requires a real Discord token. We test what we can: that the plugin registers without crashing when no token is set, that its message adapter and settings schema work correctly.

**Files:**
- Create: `tests/integration/discord-plugin.test.ts`

**Step 1: Check what the discord plugin exports**

Read `packages/plugins/discord/src/index.ts` to confirm the exported plugin name and any factory function available for testing without a live gateway.

**Step 2: Write the test**

```typescript
import { plugin as discordPlugin } from '@harness/plugin-discord';
import { PrismaClient } from 'database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('discord plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness.cleanup();
  });

  it('registers and starts without throwing when discordToken is undefined', async () => {
    // The default test config has discordToken: undefined
    // The plugin should log a warning and skip gateway connection, not throw
    await expect(
      createTestHarness(discordPlugin).then((h) => {
        harness = h;
        return h;
      }),
    ).resolves.toBeDefined();
  });

  it('plugin has correct name and version', () => {
    expect(discordPlugin.name).toBe('discord');
    expect(discordPlugin.version).toBe('1.0.0');
  });

  it('register returns hooks object (even with no token)', async () => {
    harness = await createTestHarness(discordPlugin);

    const hooks = harness.orchestrator.getHooks();
    // Discord plugin may return no hooks (it works via start/stop lifecycle, not hooks)
    expect(Array.isArray(hooks)).toBe(true);
  });
});
```

**Step 3: Run**

```bash
pnpm --filter integration-tests test:integration 2>&1 | tail -20
```

Expected: passes. The discord plugin gracefully handles missing token.

**Step 4: Commit**

```bash
git add tests/integration/discord-plugin.test.ts
git commit -m "test(integration): add discord plugin integration test — graceful no-token startup"
```

---

## Task 12: Run full integration suite and verify

Run the complete suite, check for flakiness, and verify turbo picks it up correctly.

**Step 1: Run the full suite**

```bash
pnpm --filter integration-tests test:integration 2>&1
```

Expected: All tests pass. Container starts once, all 7 test files run sequentially, container stops.

**Step 2: Run via turbo**

```bash
pnpm test:integration
```

Expected: Same result via the turbo pipeline.

**Step 3: Run unit tests to confirm nothing broke**

```bash
pnpm test
```

Expected: All existing unit tests still pass.

**Step 4: Typecheck everything**

```bash
pnpm typecheck
```

Expected: No errors.

**Step 5: Final commit**

```bash
git add .
git commit -m "test(integration): complete pipeline integration test suite — all 7 plugins"
```

---

## Troubleshooting

**`TEST_DATABASE_URL` is undefined in test workers**
Vitest's `globalSetup` runs in a separate Node process. Environment variables set via `process.env` in `globalSetup` are visible to worker processes. If not, use `process.env` in `globalSetup` and verify the vitest docs for the version in use.

**Container takes too long to start**
Increase `testTimeout` and `hookTimeout` in `vitest.config.ts`. First run pulls the Docker image; subsequent runs use the cached layer. CI may need `--pull` configured.

**`prisma db push` fails with "schema not found"**
The `cwd` path in `global-setup.ts` uses `process.cwd()` which is `tests/integration/`. The path `../../packages/database` should resolve correctly. If not, use `path.resolve(__dirname, '../../packages/database')`.

**Fire-and-forget tests are flaky**
Increase the `vi.waitFor` timeout for delegation tests. The delegation loop does a full invoke internally, which can take time even with a mock.

**Port conflicts in web plugin tests**
If port 14500-14502 are in use, change them. Or find free ports dynamically using `net.createServer().listen(0)`.

**TypeScript errors importing from 'orchestrator'**
Verify Task 1 was completed — `createOrchestrator` must be exported from `apps/orchestrator/src/index.ts`. Also check that `orchestrator` is listed as a devDependency in `tests/integration/package.json`.
