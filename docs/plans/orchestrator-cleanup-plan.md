# Orchestrator Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove dead code from the orchestrator, wire the prompt assembler into the pipeline as a baseline before hooks, and create a metrics plugin that tracks token usage via `onAfterInvoke`.

**Architecture:** Three sequential phases. Phase 1 deletes orphaned modules (old CLI invoker, response-parser, command-router, CLI-specific token helpers). Phase 2 wires the existing prompt-assembler into the orchestrator pipeline before `onBeforeInvoke` hooks. Phase 3 creates a new `@harness/plugin-metrics` package that moves the useful token-tracking helpers from the orchestrator into a proper plugin with an `onAfterInvoke` hook, then registers it in the plugin registry.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, Prisma, Turborepo

---

### Task 1: Delete old CLI invoker

**Files:**
- Delete: `apps/orchestrator/src/invoker/index.ts`
- Delete: `apps/orchestrator/src/invoker/_helpers/build-args.ts`
- Delete: `apps/orchestrator/src/invoker/_helpers/parse-json-output.ts`
- Delete: `apps/orchestrator/src/invoker/__tests__/index.test.ts`
- Delete: `apps/orchestrator/src/invoker/_helpers/__tests__/build-args.test.ts`
- Delete: `apps/orchestrator/src/invoker/_helpers/__tests__/parse-json-output.test.ts`

**Step 1: Verify no imports exist outside own tests**

Run: `cd /mnt/ramdisk/harness && grep -r "from.*invoker" apps/orchestrator/src/ --include="*.ts" | grep -v invoker-sdk | grep -v __tests__ | grep -v node_modules`
Expected: No output (only test files reference the old invoker)

**Step 2: Delete the directory**

```bash
rm -rf apps/orchestrator/src/invoker
```

**Step 3: Verify tests still pass**

Run: `pnpm --filter orchestrator test`
Expected: ALL PASS (test count drops because deleted tests are gone)

**Step 4: Commit**

```bash
cd /mnt/ramdisk/harness && git add -A apps/orchestrator/src/invoker && git commit -m "refactor(orchestrator): remove old CLI invoker, superseded by SDK invoker"
```

---

### Task 2: Delete response-parser and command-router

**Files:**
- Delete: `apps/orchestrator/src/orchestrator/_helpers/response-parser.ts`
- Delete: `apps/orchestrator/src/orchestrator/_helpers/__tests__/response-parser.test.ts`
- Delete: `apps/orchestrator/src/orchestrator/_helpers/command-router.ts`
- Delete: `apps/orchestrator/src/orchestrator/_helpers/__tests__/command-router.test.ts`

**Step 1: Verify no imports exist outside own tests**

Run: `cd /mnt/ramdisk/harness && grep -r "response-parser\|parseResponse\|command-router\|createCommandRouter" apps/orchestrator/src/ --include="*.ts" | grep -v __tests__`
Expected: Only the source files themselves (no consumers)

**Step 2: Delete the files**

```bash
rm apps/orchestrator/src/orchestrator/_helpers/response-parser.ts
rm apps/orchestrator/src/orchestrator/_helpers/__tests__/response-parser.test.ts
rm apps/orchestrator/src/orchestrator/_helpers/command-router.ts
rm apps/orchestrator/src/orchestrator/_helpers/__tests__/command-router.test.ts
```

**Step 3: Verify tests still pass**

Run: `pnpm --filter orchestrator test`
Expected: ALL PASS

**Step 4: Commit**

```bash
cd /mnt/ramdisk/harness && git add -A && git commit -m "refactor(orchestrator): remove response-parser and command-router, superseded by MCP tools"
```

---

### Task 3: Delete CLI-specific token helpers and token-usage orchestrator

**Files:**
- Delete: `apps/orchestrator/src/token-usage/index.ts`
- Delete: `apps/orchestrator/src/token-usage/__tests__/index.test.ts`
- Delete: `apps/orchestrator/src/token-usage/_helpers/parse-cli-usage.ts`
- Delete: `apps/orchestrator/src/token-usage/_helpers/__tests__/parse-cli-usage.test.ts`
- Delete: `apps/orchestrator/src/token-usage/_helpers/estimate-tokens.ts`
- Delete: `apps/orchestrator/src/token-usage/_helpers/__tests__/estimate-tokens.test.ts`
- Keep (for now): `apps/orchestrator/src/token-usage/_helpers/calculate-cost.ts` + test
- Keep (for now): `apps/orchestrator/src/token-usage/_helpers/record-usage-metrics.ts` + test

**Step 1: Delete the CLI-specific files and the orchestrator**

```bash
rm apps/orchestrator/src/token-usage/index.ts
rm apps/orchestrator/src/token-usage/__tests__/index.test.ts
rm apps/orchestrator/src/token-usage/_helpers/parse-cli-usage.ts
rm apps/orchestrator/src/token-usage/_helpers/__tests__/parse-cli-usage.test.ts
rm apps/orchestrator/src/token-usage/_helpers/estimate-tokens.ts
rm apps/orchestrator/src/token-usage/_helpers/__tests__/estimate-tokens.test.ts
```

**Step 2: Verify tests still pass**

Run: `pnpm --filter orchestrator test`
Expected: ALL PASS (the kept helpers still have their tests)

**Step 3: Commit**

```bash
cd /mnt/ramdisk/harness && git add -A && git commit -m "refactor(orchestrator): remove CLI-specific token helpers and unused orchestrator"
```

---

### Task 4: Wire prompt assembler into orchestrator pipeline

**Files:**
- Modify: `apps/orchestrator/src/orchestrator/index.ts`
- Modify: `apps/orchestrator/src/orchestrator/__tests__/index.test.ts`

**Step 1: Write failing tests**

Add mock for prompt-assembler and update test expectations in `apps/orchestrator/src/orchestrator/__tests__/index.test.ts`.

Add a mock at the top with the other mocks:

```typescript
vi.mock('../_helpers/prompt-assembler', () => ({
  assemblePrompt: vi.fn().mockImplementation((message: string, _meta: unknown) => ({
    prompt: `[assembled] ${message}`,
    threadMeta: _meta,
  })),
}));
```

Import and wire:

```typescript
import { assemblePrompt } from '../_helpers/prompt-assembler';
const mockAssemblePrompt = vi.mocked(assemblePrompt);
```

Update the `makeDeps` helper — the thread `findUnique` mock needs to return `kind` and `name` in addition to `sessionId` and `model`:

```typescript
thread: {
  findUnique: vi.fn().mockResolvedValue({ sessionId: null, model: null, kind: 'primary', name: 'Main' }),
  update: vi.fn().mockResolvedValue({}),
},
```

Add these new tests:

```typescript
it('calls assemblePrompt with message and thread metadata before onBeforeInvoke', async () => {
  const deps = makeDeps();
  vi.mocked(deps.db.thread.findUnique).mockResolvedValue({
    sessionId: null,
    model: null,
    kind: 'task',
    name: 'Research Task',
  } as never);

  const orchestrator = createOrchestrator(deps);
  await orchestrator.handleMessage('thread-1', 'user', 'do research');

  expect(mockAssemblePrompt).toHaveBeenCalledWith('do research', {
    threadId: 'thread-1',
    kind: 'task',
    name: 'Research Task',
  });
});

it('passes assembled prompt to onBeforeInvoke chain hooks', async () => {
  const deps = makeDeps();
  const orchestrator = createOrchestrator(deps);
  await orchestrator.handleMessage('thread-1', 'user', 'hello');

  // assemblePrompt wraps the message, then chain hooks receive the assembled version
  expect(mockRunChainHooks).toHaveBeenCalledWith(
    expect.any(Array),
    'thread-1',
    '[assembled] hello',
    deps.logger,
  );
});

it('uses kind "general" when thread is not found', async () => {
  const deps = makeDeps();
  vi.mocked(deps.db.thread.findUnique).mockResolvedValue(null);

  const orchestrator = createOrchestrator(deps);
  await orchestrator.handleMessage('thread-new', 'user', 'hi');

  expect(mockAssemblePrompt).toHaveBeenCalledWith('hi', {
    threadId: 'thread-new',
    kind: 'general',
    name: undefined,
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter orchestrator test -- src/orchestrator/__tests__/index.test.ts`
Expected: FAIL — `assemblePrompt` is not called in the pipeline yet

**Step 3: Implement — modify orchestrator/index.ts**

Add the import at the top:

```typescript
import { assemblePrompt } from './_helpers/prompt-assembler';
```

In `handleMessage`, after the thread query (step 0), add thread metadata extraction and call `assemblePrompt` before `runChainHooks`:

Change step 0 to select `kind` and `name`:

```typescript
// Step 0: Look up thread for session resumption and model override
const thread = await deps.db.thread.findUnique({
  where: { id: threadId },
  select: { sessionId: true, model: true, kind: true, name: true },
});
```

After step 1 (onMessage hooks), replace the `runChainHooks` call:

```typescript
// Step 2: Build baseline prompt from thread context
const threadMeta = {
  threadId,
  kind: (thread?.kind as string) ?? 'general',
  name: (thread?.name as string) ?? undefined,
};
const { prompt: basePrompt } = assemblePrompt(content, threadMeta);

// Step 3: Run onBeforeInvoke hooks in sequence (each can modify prompt)
deps.logger.info(`Pipeline: onBeforeInvoke [thread=${threadId}]`);
const prompt = await runChainHooks(hooks, threadId, basePrompt, deps.logger);
```

Update step numbering in subsequent comments (step 3 → step 4, etc).

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter orchestrator test -- src/orchestrator/__tests__/index.test.ts`
Expected: ALL PASS

**Step 5: Run full test suite and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: ALL PASS

**Step 6: Commit**

```bash
cd /mnt/ramdisk/harness && git add apps/orchestrator/src/orchestrator/index.ts apps/orchestrator/src/orchestrator/__tests__/index.test.ts && git commit -m "feat(orchestrator): wire prompt assembler as baseline before onBeforeInvoke hooks"
```

---

### Task 5: Create metrics plugin package scaffold

**Files:**
- Create: `packages/plugins/metrics/package.json`
- Create: `packages/plugins/metrics/tsconfig.json`
- Create: `packages/plugins/metrics/vitest.config.ts`

**Step 1: Create package.json**

Create `packages/plugins/metrics/package.json`:

```json
{
  "name": "@harness/plugin-metrics",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@harness/plugin-contract": "workspace:*",
    "database": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.19.11",
    "@vitest/coverage-v8": "^4.0.18",
    "tsup": "^8.5.0",
    "typescript": "^5.9.3",
    "vitest": "^4.0.18"
  }
}
```

**Step 2: Create tsconfig.json**

Create `packages/plugins/metrics/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create vitest.config.ts**

Create `packages/plugins/metrics/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-metrics',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
```

**Step 4: Install dependencies**

Run: `cd /mnt/ramdisk/harness && pnpm install`
Expected: Lockfile updated, no errors

**Step 5: Commit**

```bash
cd /mnt/ramdisk/harness && git add packages/plugins/metrics/ pnpm-lock.yaml && git commit -m "chore(metrics): scaffold metrics plugin package"
```

---

### Task 6: Move calculate-cost and record-usage-metrics to metrics plugin

**Files:**
- Move: `apps/orchestrator/src/token-usage/_helpers/calculate-cost.ts` -> `packages/plugins/metrics/src/_helpers/calculate-cost.ts`
- Move: `apps/orchestrator/src/token-usage/_helpers/__tests__/calculate-cost.test.ts` -> `packages/plugins/metrics/src/_helpers/__tests__/calculate-cost.test.ts`
- Move: `apps/orchestrator/src/token-usage/_helpers/record-usage-metrics.ts` -> `packages/plugins/metrics/src/_helpers/record-usage-metrics.ts`
- Move: `apps/orchestrator/src/token-usage/_helpers/__tests__/record-usage-metrics.test.ts` -> `packages/plugins/metrics/src/_helpers/__tests__/record-usage-metrics.test.ts`
- Delete: remaining empty `apps/orchestrator/src/token-usage/` directory

**Step 1: Create directory structure**

```bash
mkdir -p packages/plugins/metrics/src/_helpers/__tests__
```

**Step 2: Move files**

```bash
mv apps/orchestrator/src/token-usage/_helpers/calculate-cost.ts packages/plugins/metrics/src/_helpers/calculate-cost.ts
mv apps/orchestrator/src/token-usage/_helpers/__tests__/calculate-cost.test.ts packages/plugins/metrics/src/_helpers/__tests__/calculate-cost.test.ts
mv apps/orchestrator/src/token-usage/_helpers/record-usage-metrics.ts packages/plugins/metrics/src/_helpers/record-usage-metrics.ts
mv apps/orchestrator/src/token-usage/_helpers/__tests__/record-usage-metrics.test.ts packages/plugins/metrics/src/_helpers/__tests__/record-usage-metrics.test.ts
```

**Step 3: Delete the now-empty token-usage directory**

```bash
rm -rf apps/orchestrator/src/token-usage
```

**Step 4: Verify moved tests pass in new location**

Run: `pnpm --filter @harness/plugin-metrics test`
Expected: ALL PASS (11 tests from calculate-cost + record-usage-metrics)

**Step 5: Verify orchestrator tests still pass (no breakage)**

Run: `pnpm --filter orchestrator test`
Expected: ALL PASS

**Step 6: Commit**

```bash
cd /mnt/ramdisk/harness && git add -A && git commit -m "refactor(metrics): move calculate-cost and record-usage-metrics to metrics plugin"
```

---

### Task 7: Implement metrics plugin with onAfterInvoke hook

**Files:**
- Create: `packages/plugins/metrics/src/index.ts`
- Create: `packages/plugins/metrics/src/__tests__/index.test.ts`

**Step 1: Write failing tests**

Create `packages/plugins/metrics/src/__tests__/index.test.ts`:

```typescript
import type { InvokeResult, PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../_helpers/calculate-cost', () => ({
  calculateCost: vi.fn().mockReturnValue({
    inputCost: 0.003,
    outputCost: 0.0075,
    totalCost: 0.0105,
  }),
}));

vi.mock('../_helpers/record-usage-metrics', () => ({
  recordUsageMetrics: vi.fn().mockResolvedValue(undefined),
}));

import { calculateCost } from '../_helpers/calculate-cost';
import { recordUsageMetrics } from '../_helpers/record-usage-metrics';
import { plugin } from '../index';

const mockCalculateCost = vi.mocked(calculateCost);
const mockRecordUsageMetrics = vi.mocked(recordUsageMetrics);

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () => ({
  db: {} as never,
  invoker: { invoke: vi.fn() },
  config: {
    claudeModel: 'sonnet',
    databaseUrl: '',
    timezone: 'UTC',
    maxConcurrentAgents: 5,
    claudeTimeout: 30000,
    discordToken: undefined,
    discordChannelId: undefined,
    port: 3001,
    logLevel: 'info',
  } as never,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  sendToThread: vi.fn(),
  broadcast: vi.fn().mockResolvedValue(undefined),
});

describe('metrics plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('metrics');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers and returns onAfterInvoke hook', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks.onAfterInvoke).toBeDefined();
    expect(typeof hooks.onAfterInvoke).toBe('function');
  });

  it('calculates cost and records metrics on invoke', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result: InvokeResult = {
      output: 'Hello!',
      durationMs: 1000,
      exitCode: 0,
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(mockCalculateCost).toHaveBeenCalledWith('claude-sonnet-4-20250514', 1000, 500);
    expect(mockRecordUsageMetrics).toHaveBeenCalledWith(ctx.db, {
      threadId: 'thread-1',
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
      costEstimate: 0.0105,
    });
  });

  it('skips recording when model is missing from result', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result: InvokeResult = {
      output: 'Hello!',
      durationMs: 1000,
      exitCode: 0,
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(mockCalculateCost).not.toHaveBeenCalled();
    expect(mockRecordUsageMetrics).not.toHaveBeenCalled();
  });

  it('skips recording when token counts are missing', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result: InvokeResult = {
      output: 'Hello!',
      durationMs: 1000,
      exitCode: 0,
      model: 'sonnet',
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(mockRecordUsageMetrics).not.toHaveBeenCalled();
  });

  it('logs error and continues when recording fails', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    mockRecordUsageMetrics.mockRejectedValueOnce(new Error('DB down'));

    const result: InvokeResult = {
      output: 'Hello!',
      durationMs: 1000,
      exitCode: 0,
      model: 'sonnet',
      inputTokens: 100,
      outputTokens: 50,
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('DB down'));
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @harness/plugin-metrics test`
Expected: FAIL — `plugin` is not exported from index.ts

**Step 3: Implement the plugin**

Create `packages/plugins/metrics/src/index.ts`:

```typescript
// Metrics plugin — tracks token usage and cost via onAfterInvoke hook

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { calculateCost } from './_helpers/calculate-cost';
import { recordUsageMetrics } from './_helpers/record-usage-metrics';

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Metrics plugin registered');

    return {
      onAfterInvoke: async (threadId, result) => {
        const { model, inputTokens, outputTokens } = result;

        if (!model || inputTokens == null || outputTokens == null) {
          return;
        }

        try {
          const { totalCost } = calculateCost(model, inputTokens, outputTokens);

          await recordUsageMetrics(ctx.db, {
            threadId,
            model,
            inputTokens,
            outputTokens,
            costEstimate: totalCost,
          });
        } catch (err) {
          ctx.logger.error(`Metrics: failed to record usage: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    };
  };

  return register;
};

export const plugin: PluginDefinition = {
  name: 'metrics',
  version: '1.0.0',
  register: createRegister(),
};
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @harness/plugin-metrics test`
Expected: ALL PASS

**Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: ALL PASS

**Step 6: Commit**

```bash
cd /mnt/ramdisk/harness && git add packages/plugins/metrics/src/ && git commit -m "feat(metrics): implement metrics plugin with onAfterInvoke token tracking"
```

---

### Task 8: Register metrics plugin in plugin registry

**Files:**
- Modify: `apps/orchestrator/src/plugin-registry/index.ts`
- Modify: `apps/orchestrator/src/plugin-registry/__tests__/index.test.ts`
- Modify: `apps/orchestrator/package.json` (add dependency)

**Step 1: Add dependency to orchestrator**

Add `"@harness/plugin-metrics": "workspace:*"` to `apps/orchestrator/package.json` dependencies.

Run: `cd /mnt/ramdisk/harness && pnpm install`

**Step 2: Write failing test**

In `apps/orchestrator/src/plugin-registry/__tests__/index.test.ts`, add:

```typescript
it('includes the metrics plugin', async () => {
  const plugins = await getPlugins(makeDb(), makeLogger());
  const names = plugins.map((p) => p.name);

  expect(names).toContain('metrics');
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm --filter orchestrator test -- src/plugin-registry/__tests__/index.test.ts`
Expected: FAIL — metrics plugin not in registry

**Step 4: Add metrics plugin to registry**

In `apps/orchestrator/src/plugin-registry/index.ts`, add the import and include in `ALL_PLUGINS`:

```typescript
import { plugin as metricsPlugin } from '@harness/plugin-metrics';
```

Update `ALL_PLUGINS`:

```typescript
const ALL_PLUGINS: PluginDefinition[] = [contextPlugin, discordPlugin, webPlugin, delegationPlugin, metricsPlugin];
```

**Step 5: Run test to verify it passes**

Run: `pnpm --filter orchestrator test -- src/plugin-registry/__tests__/index.test.ts`
Expected: ALL PASS

**Step 6: Run full test suite and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: ALL PASS

**Step 7: Commit**

```bash
cd /mnt/ramdisk/harness && git add apps/orchestrator/package.json apps/orchestrator/src/plugin-registry/ pnpm-lock.yaml && git commit -m "feat(orchestrator): register metrics plugin in plugin registry"
```

---

### Task 9: Final validation

**Step 1: Run full CI pipeline**

Run: `pnpm ci`
Expected: ALL PASS (sherif -> typecheck -> lint -> build)

**Step 2: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

**Step 3: Verify no dangling imports**

Run: `cd /mnt/ramdisk/harness && grep -r "token-usage\|createInvoker\|parseResponse\|createCommandRouter\|response-parser\|command-router" apps/orchestrator/src/ --include="*.ts" | grep -v node_modules`
Expected: No output

**Step 4: Verify the metrics plugin is in the build**

Run: `pnpm --filter @harness/plugin-metrics build`
Expected: Build succeeds, dist/ contains index.js, index.cjs, index.d.ts

**Step 5: Commit any remaining lint/format fixes**

If Biome applied auto-fixes:

```bash
cd /mnt/ramdisk/harness && git add -A && git commit -m "chore: lint and format fixes for orchestrator cleanup"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Delete old CLI invoker | `src/invoker/` (6 files) |
| 2 | Delete response-parser + command-router | 4 files in `src/orchestrator/_helpers/` |
| 3 | Delete CLI-specific token helpers | 6 files in `src/token-usage/` |
| 4 | Wire prompt assembler into pipeline | `orchestrator/index.ts` + tests |
| 5 | Scaffold metrics plugin package | `packages/plugins/metrics/` (3 config files) |
| 6 | Move cost + metrics helpers | 4 files move from `src/token-usage/` to `packages/plugins/metrics/` |
| 7 | Implement metrics plugin | `packages/plugins/metrics/src/index.ts` + tests |
| 8 | Register in plugin registry | `src/plugin-registry/index.ts` + tests |
| 9 | Final validation | CI pipeline, import verification |
