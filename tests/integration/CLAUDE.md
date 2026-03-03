# Integration Tests — CLAUDE.md

This directory contains end-to-end integration tests for all Harness plugins.
These tests run a real orchestrator against a real PostgreSQL database (via Docker testcontainers).

## What Integration Tests Cover

Integration tests verify that a plugin's hooks produce the correct **side effects** (DB rows, HTTP calls, broadcasts) when wired into the full orchestrator pipeline. They complement unit tests, which test logic in isolation.

- **Unit tests** (`packages/plugins/*/src/__tests__/`) — mock all dependencies, test one function at a time
- **Integration tests** (this directory) — real DB, real orchestrator pipeline, mocked invoker only

## Running the Tests

```bash
# From repo root
pnpm --filter integration-tests test:integration

# Watch mode
pnpm --filter integration-tests test:integration:watch

# From this directory
pnpm test:integration
```

Docker must be running — the global setup spins up a `postgres:16-alpine` testcontainer.

## Architecture

### Global Setup (`setup/global-setup.ts`)

Runs once before the entire suite:
1. Starts a `PostgreSqlContainer` (Docker)
2. Sets `process.env.TEST_DATABASE_URL`
3. Pushes the Prisma schema via `prisma db push`

### Per-Test Reset (`setup/reset-db.ts`)

`resetDatabase(prisma)` is called in `beforeEach` of every test file. It `TRUNCATE ... RESTART IDENTITY CASCADE` all tables so each test starts with a clean slate.

### `createTestHarness` (`helpers/create-harness.ts`)

The central factory. Call it with one plugin, get back a fully booted orchestrator:

```typescript
const harness = await createTestHarness(myPlugin, opts?);
// harness.orchestrator  — real orchestrator instance
// harness.prisma        — real PrismaClient pointed at testcontainer
// harness.invoker.invoke — vi.fn() — mock Claude, control its output
// harness.threadId      — a pre-created test thread ID
// harness.cleanup()     — stops orchestrator + disconnects prisma
```

Always call `harness.cleanup()` in `afterEach`.

#### Opts

```typescript
type CreateTestHarnessOpts = {
  invokerOutput?: string;        // default: 'ok'
  invokerModel?: string;         // default: 'claude-haiku-4-5-20251001'
  invokerTokens?: { inputTokens: number; outputTokens: number }; // default: 100/50
  port?: number;                 // default: 0 (OS-assigned, for web plugin tests)
};
```

## Writing a New Integration Test

### File naming

One file per plugin: `{plugin-name}-plugin.test.ts`

### Use `sendToThread`, not `handleMessage` for pipeline hook tests

`sendToThread` fires the outer lifecycle hooks (`onPipelineStart`, `onPipelineComplete`) in addition to the 8-step `handleMessage` pipeline. Tests for `onMessage`, `onBeforeInvoke`, `onAfterInvoke`, etc. should go through `sendToThread` to match production behavior:

```typescript
await harness.orchestrator.getContext().sendToThread(harness.threadId, 'hello');
```

Use `handleMessage` directly only when you specifically want to test the 8-step pipeline in isolation (no outer lifecycle hooks).

### Standard test structure

```typescript
import { plugin as myPlugin } from '@harness/plugin-my';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env['TEST_DATABASE_URL'] });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('my plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('does the thing', async () => {
    harness = await createTestHarness(myPlugin);
    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'hello');
    // assert against prisma or harness.invoker.invoke
  });
});
```

### Controlling the mock invoker

Override `invoke` mid-test to simulate Claude emitting stream events:

```typescript
harness.invoker.invoke.mockImplementation(async (_prompt, opts) => {
  opts?.onMessage?.({ type: 'thinking', content: '...', timestamp: Date.now() });
  return { output: 'done', durationMs: 10, exitCode: 0, model: '...', inputTokens: 100, outputTokens: 50, sessionId: undefined };
});
```

## Plugin Coverage

| Plugin | Integration test file | Status |
|--------|----------------------|--------|
| activity | `activity-plugin.test.ts` | ✓ |
| context | `context-plugin.test.ts` | ✓ |
| delegation | `delegation-plugin.test.ts` | ✓ |
| discord | `discord-plugin.test.ts` | ✓ |
| metrics | `metrics-plugin.test.ts` | ✓ |
| time | `time-plugin.test.ts` | ✓ |
| web | `web-plugin.test.ts` | ✓ |
| validator | `validator-plugin.test.ts` | ✓ |
| identity | — | ✗ missing |
| cron | — | ✗ missing |
| auto-namer | — | ✗ missing |
| audit | — | ✗ missing |
| summarization | — | ✗ missing |
| project | — | ✗ missing |

When adding a new plugin to `packages/plugins/`, add it to `package.json` devDependencies here and create `{plugin-name}-plugin.test.ts`.

## Key Constraints

- **`fileParallelism: false`** — test files run sequentially. The shared testcontainer DB cannot safely handle concurrent writes from multiple test files.
- **90 second timeouts** — Docker container startup dominates cold-start time; subsequent tests are fast.
- **Port 0** — pass `port: 0` in opts for web plugin tests; the OS assigns a free port automatically.
