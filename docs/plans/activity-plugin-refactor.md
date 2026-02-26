# Activity Plugin Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract Rich Activity persistence (pipeline_start, pipeline_step, thinking, tool_call, tool_result, pipeline_complete) from `sendToThread` in orchestrator core into a dedicated `@harness/plugin-activity` plugin, restoring architectural correctness.

**Architecture:** Add `onPipelineStart` and `onPipelineComplete` hooks to the plugin contract. The activity plugin implements both hooks and owns all Rich Activity DB writes. `sendToThread` retains only innate behavior: running the pipeline and persisting the assistant text reply + thread lastActivity. `parsePluginSource` moves from orchestrator internals to the activity plugin, with a corrected regex (`/^(\w+?)__/` — real tool names are `delegation__delegate`, not `delegationPlugin__delegate`). In `sendToThread`, `onPipelineComplete` fires **before** innate assistant text persistence so that thinking/tool_call records get earlier `createdAt` values than the reply (the UI sorts by `createdAt: 'asc'`). Note: `pipeline_complete` will therefore appear before `assistant_text` in the DB — this is intentional; the alternative (thinking blocks after the reply) is a more significant regression.

**Tech Stack:** TypeScript, `@harness/plugin-contract`, Prisma (via `database` workspace package), Vitest, tsup, pnpm workspaces

---

## Adversarial Review Checklist

Before implementation, verify these assumptions hold:

- [ ] `runNotifyHooks` second arg is a plain string (not `keyof PluginHooks`) — confirmed: `type RunNotifyHooks = (..., hookName: string, ...) => Promise<void>`
- [ ] `allHooks()` is accessible within the `sendToThread` closure in orchestrator — confirmed: it reads from `plugins[]` array in scope
- [ ] `PipelineStep` is only defined in orchestrator (not already in plugin-contract) — confirmed at `orchestrator/index.ts:28-32`
- [ ] `parsePluginSource` is only used in `sendToThread` (not elsewhere in orchestrator) — confirm with: `grep -r "parsePluginSource" apps/orchestrator/src/`
- [ ] `onPipelineComplete` fires BEFORE innate assistant message persistence — ensures thinking/tool_call records have earlier `createdAt` than assistant_text (UI sorts by `createdAt: 'asc'` in `message-list.tsx:19`)
- [ ] `@harness/plugin-contract` is already a dependency of the orchestrator app — confirm with: `cat apps/orchestrator/package.json | grep plugin-contract`

---

## Task 1: Extend Plugin Contract

**Files:**
- Modify: `packages/plugin-contract/src/index.ts`

`PipelineStep` currently lives in the orchestrator and is invisible to plugins. Move it to the contract and add two new hooks.

**Step 1: Add `PipelineStep` type after `InvokeStreamEvent` (line 36)**

Insert after the closing `};` of `InvokeStreamEvent`:

```typescript
export type PipelineStep = {
  step: string;
  detail?: string;
  timestamp: number;
};
```

**Step 2: Add two new hooks to `PluginHooks`**

In `PluginHooks` (currently ends at line 81), add before the closing `};`:

```typescript
  onPipelineStart?: (threadId: string) => Promise<void>;
  onPipelineComplete?: (
    threadId: string,
    result: {
      invokeResult: InvokeResult;
      pipelineSteps: PipelineStep[];
      streamEvents: InvokeStreamEvent[];
      commandsHandled: string[];
    },
  ) => Promise<void>;
```

**Step 3: Run typecheck to verify**

```bash
pnpm --filter @harness/plugin-contract typecheck
```
Expected: no errors

**Step 4: Commit**

```bash
git add packages/plugin-contract/src/index.ts
git commit -m "feat(plugin-contract): add PipelineStep type and onPipelineStart/onPipelineComplete hooks"
```

---

## Task 2: Scaffold Activity Plugin Package

**Files:**
- Create: `packages/plugins/activity/package.json`
- Create: `packages/plugins/activity/tsconfig.json`
- Create: `packages/plugins/activity/vitest.config.ts`
- Create: `packages/plugins/activity/src/index.ts` (skeleton only)

**Step 1: Create `packages/plugins/activity/package.json`**

```json
{
  "name": "@harness/plugin-activity",
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

**Step 2: Create `packages/plugins/activity/tsconfig.json`**

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

**Step 3: Create `packages/plugins/activity/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "plugin-activity",
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
```

**Step 4: Create skeleton `packages/plugins/activity/src/index.ts`**

```typescript
import type { PluginDefinition } from "@harness/plugin-contract";

// All existing plugins use `export const plugin` inline — match this pattern
export const plugin: PluginDefinition = {
  name: "activity",
  version: "1.0.0",
  register: async (_ctx) => ({}),
};
```

**Step 5: Install workspace dependencies**

```bash
pnpm install
```
Expected: `@harness/plugin-activity` linked in workspace

**Step 6: Typecheck the skeleton**

```bash
pnpm --filter @harness/plugin-activity typecheck
```
Expected: no errors

**Step 7: Commit**

```bash
git add packages/plugins/activity/
git commit -m "feat(activity): scaffold @harness/plugin-activity package"
```

---

## Task 3: `parse-plugin-source` Helper (TDD)

**Files:**
- Create: `packages/plugins/activity/src/_helpers/parse-plugin-source.ts`
- Create: `packages/plugins/activity/src/_helpers/__tests__/parse-plugin-source.test.ts`

This logic currently lives in `apps/orchestrator/src/orchestrator/_helpers/parse-plugin-source.ts`. The activity plugin needs it to determine the `source` field for `tool_call` messages. It maps tool names like `delegation__delegate` to `"delegation"`.

> **Bug fix vs original:** The existing orchestrator helper uses regex `/^(\w+?)Plugin__/` which **never matches** real tool names. The tool server generates names as `${p.name}__${t.name}` (e.g., `delegation__delegate`, `time__current_time`) — no `Plugin` suffix. The correct regex is `/^(\w+?)__/`. The original helper has been silently returning `"builtin"` for all plugin tool calls.

**Step 1: Write the failing test**

```typescript
// packages/plugins/activity/src/_helpers/__tests__/parse-plugin-source.test.ts
import { describe, expect, it } from "vitest";
import { parsePluginSource } from "../parse-plugin-source";

describe("parsePluginSource", () => {
  it("returns builtin for core tool names", () => {
    expect(parsePluginSource("Read")).toBe("builtin");
    expect(parsePluginSource("Bash")).toBe("builtin");
    expect(parsePluginSource("Write")).toBe("builtin");
  });

  it("extracts plugin name from pluginName__method format", () => {
    // Real tool server format is `${p.name}__${t.name}` — no "Plugin" suffix
    expect(parsePluginSource("delegation__delegate")).toBe("delegation");
    expect(parsePluginSource("time__current_time")).toBe("time");
    expect(parsePluginSource("discord__send-message")).toBe("discord");
  });

  it("returns builtin for undefined", () => {
    expect(parsePluginSource(undefined)).toBe("builtin");
  });

  it("returns builtin for unrecognized format", () => {
    expect(parsePluginSource("someRandomTool")).toBe("builtin");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @harness/plugin-activity test
```
Expected: FAIL — `parsePluginSource` not found

**Step 3: Implement**

```typescript
// packages/plugins/activity/src/_helpers/parse-plugin-source.ts
type ParsePluginSource = (toolName: string | undefined) => string;

const parsePluginSource: ParsePluginSource = (toolName) => {
  if (!toolName) {
    return "builtin";
  }
  // Tool server generates names as `${p.name}__${t.name}` (e.g. "delegation__delegate")
  // The original orchestrator regex /^(\w+?)Plugin__/ was silently broken — never matched.
  const match = /^(\w+?)__/.exec(toolName);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }
  return "builtin";
};

export { parsePluginSource };
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @harness/plugin-activity test
```
Expected: PASS

**Step 5: Commit**

```bash
git add packages/plugins/activity/src/_helpers/parse-plugin-source.ts \
        packages/plugins/activity/src/_helpers/__tests__/parse-plugin-source.test.ts
git commit -m "feat(activity): add parse-plugin-source helper"
```

---

## Task 4: `persist-pipeline-start` Helper (TDD)

**Files:**
- Create: `packages/plugins/activity/src/_helpers/persist-pipeline-start.ts`
- Create: `packages/plugins/activity/src/_helpers/__tests__/persist-pipeline-start.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/plugins/activity/src/_helpers/__tests__/persist-pipeline-start.test.ts
import { describe, expect, it, vi } from "vitest";
import { persistPipelineStart } from "../persist-pipeline-start";

const makeDb = () => ({
  message: { create: vi.fn().mockResolvedValue({}) },
});

describe("persistPipelineStart", () => {
  it("creates a pipeline_start status message", async () => {
    const db = makeDb();
    await persistPipelineStart(db as never, "thread-1");

    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: "thread-1",
        role: "system",
        kind: "status",
        source: "pipeline",
        content: "Pipeline started",
        metadata: { event: "pipeline_start" },
      },
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @harness/plugin-activity test
```
Expected: FAIL — `persistPipelineStart` not found

**Step 3: Implement**

```typescript
// packages/plugins/activity/src/_helpers/persist-pipeline-start.ts
import type { PrismaClient } from "database";

type PersistPipelineStart = (db: PrismaClient, threadId: string) => Promise<void>;

const persistPipelineStart: PersistPipelineStart = async (db, threadId) => {
  await db.message.create({
    data: {
      threadId,
      role: "system",
      kind: "status",
      source: "pipeline",
      content: "Pipeline started",
      metadata: { event: "pipeline_start" },
    },
  });
};

export { persistPipelineStart };
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @harness/plugin-activity test
```
Expected: PASS

**Step 5: Commit**

```bash
git add packages/plugins/activity/src/_helpers/persist-pipeline-start.ts \
        packages/plugins/activity/src/_helpers/__tests__/persist-pipeline-start.test.ts
git commit -m "feat(activity): add persist-pipeline-start helper"
```

---

## Task 5: `persist-stream-events` Helper (TDD)

**Files:**
- Create: `packages/plugins/activity/src/_helpers/persist-stream-events.ts`
- Create: `packages/plugins/activity/src/_helpers/__tests__/persist-stream-events.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/plugins/activity/src/_helpers/__tests__/persist-stream-events.test.ts
import type { InvokeStreamEvent } from "@harness/plugin-contract";
import { describe, expect, it, vi } from "vitest";
import { persistStreamEvents } from "../persist-stream-events";

const makeDb = () => ({
  message: { create: vi.fn().mockResolvedValue({}) },
});

describe("persistStreamEvents", () => {
  it("persists thinking events as kind:thinking", async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = { type: "thinking", content: "Let me think.", timestamp: Date.now() };

    await persistStreamEvents(db as never, "thread-1", [event]);

    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: "thread-1",
        role: "assistant",
        kind: "thinking",
        source: "builtin",
        content: "Let me think.",
      },
    });
  });

  it("persists tool_call events as kind:tool_call with plugin source", async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = {
      type: "tool_call",
      toolName: "delegation__delegate", // real tool server format: ${p.name}__${t.name}
      toolUseId: "tu-1",
      toolInput: { task: "do something" },
      timestamp: Date.now(),
    };

    await persistStreamEvents(db as never, "thread-1", [event]);

    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: "thread-1",
        role: "assistant",
        kind: "tool_call",
        source: "delegation",
        content: "delegation__delegate",
        metadata: {
          toolName: "delegation__delegate",
          toolUseId: "tu-1",
          input: { task: "do something" },
        },
      },
    });
  });

  it("persists tool_use_summary events as kind:tool_result", async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = {
      type: "tool_use_summary",
      content: "Listed 5 files",
      toolUseId: "tu-2",
      timestamp: Date.now(),
    };

    await persistStreamEvents(db as never, "thread-1", [event]);

    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: "thread-1",
        role: "assistant",
        kind: "tool_result",
        source: "builtin",
        content: "Listed 5 files",
        metadata: { toolUseId: "tu-2", success: true },
      },
    });
  });

  it("skips unknown event types", async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = { type: "unknown_type", timestamp: Date.now() };

    await persistStreamEvents(db as never, "thread-1", [event]);

    expect(db.message.create).not.toHaveBeenCalled();
  });

  it("skips thinking events with no content", async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = { type: "thinking", timestamp: Date.now() };

    await persistStreamEvents(db as never, "thread-1", [event]);

    expect(db.message.create).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @harness/plugin-activity test
```
Expected: FAIL

**Step 3: Implement**

```typescript
// packages/plugins/activity/src/_helpers/persist-stream-events.ts
import type { InvokeStreamEvent } from "@harness/plugin-contract";
import type { PrismaClient } from "database";
import { parsePluginSource } from "./parse-plugin-source";

type PersistStreamEvents = (
  db: PrismaClient,
  threadId: string,
  events: InvokeStreamEvent[],
) => Promise<void>;

const persistStreamEvents: PersistStreamEvents = async (db, threadId, events) => {
  for (const event of events) {
    if (event.type === "thinking" && event.content) {
      await db.message.create({
        data: { threadId, role: "assistant", kind: "thinking", source: "builtin", content: event.content },
      });
    } else if (event.type === "tool_call" && event.toolName) {
      await db.message.create({
        data: {
          threadId,
          role: "assistant",
          kind: "tool_call",
          source: parsePluginSource(event.toolName),
          content: event.toolName,
          metadata: {
            toolName: event.toolName,
            toolUseId: event.toolUseId ?? null,
            input: event.toolInput ?? null,
          },
        },
      });
    } else if (event.type === "tool_use_summary" && event.content) {
      await db.message.create({
        data: {
          threadId,
          role: "assistant",
          kind: "tool_result",
          source: "builtin",
          content: event.content,
          metadata: { toolUseId: event.toolUseId ?? null, success: true },
        },
      });
    }
  }
};

export { persistStreamEvents };
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @harness/plugin-activity test
```
Expected: PASS

**Step 5: Commit**

```bash
git add packages/plugins/activity/src/_helpers/persist-stream-events.ts \
        packages/plugins/activity/src/_helpers/__tests__/persist-stream-events.test.ts
git commit -m "feat(activity): add persist-stream-events helper"
```

---

## Task 6: `persist-pipeline-steps` Helper (TDD)

**Files:**
- Create: `packages/plugins/activity/src/_helpers/persist-pipeline-steps.ts`
- Create: `packages/plugins/activity/src/_helpers/__tests__/persist-pipeline-steps.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/plugins/activity/src/_helpers/__tests__/persist-pipeline-steps.test.ts
import type { PipelineStep } from "@harness/plugin-contract";
import { describe, expect, it, vi } from "vitest";
import { persistPipelineSteps } from "../persist-pipeline-steps";

const makeDb = () => ({
  message: { create: vi.fn().mockResolvedValue({}) },
});

describe("persistPipelineSteps", () => {
  it("creates a pipeline_step message per step", async () => {
    const db = makeDb();
    const steps: PipelineStep[] = [
      { step: "onMessage", timestamp: 1000 },
      { step: "invoking", detail: "claude-sonnet-4-6", timestamp: 2000 },
    ];

    await persistPipelineSteps(db as never, "thread-1", steps);

    expect(db.message.create).toHaveBeenCalledTimes(2);
    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: "thread-1",
        role: "system",
        kind: "pipeline_step",
        source: "pipeline",
        content: "onMessage",
        metadata: { step: "onMessage", detail: null },
      },
    });
    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: "thread-1",
        role: "system",
        kind: "pipeline_step",
        source: "pipeline",
        content: "invoking",
        metadata: { step: "invoking", detail: "claude-sonnet-4-6" },
      },
    });
  });

  it("does nothing for empty steps array", async () => {
    const db = makeDb();
    await persistPipelineSteps(db as never, "thread-1", []);
    expect(db.message.create).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @harness/plugin-activity test
```
Expected: FAIL

**Step 3: Implement**

```typescript
// packages/plugins/activity/src/_helpers/persist-pipeline-steps.ts
import type { PipelineStep } from "@harness/plugin-contract";
import type { PrismaClient } from "database";

type PersistPipelineSteps = (
  db: PrismaClient,
  threadId: string,
  steps: PipelineStep[],
) => Promise<void>;

const persistPipelineSteps: PersistPipelineSteps = async (db, threadId, steps) => {
  for (const step of steps) {
    await db.message.create({
      data: {
        threadId,
        role: "system",
        kind: "pipeline_step",
        source: "pipeline",
        content: step.step,
        metadata: { step: step.step, detail: step.detail ?? null },
      },
    });
  }
};

export { persistPipelineSteps };
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @harness/plugin-activity test
```
Expected: PASS

**Step 5: Commit**

```bash
git add packages/plugins/activity/src/_helpers/persist-pipeline-steps.ts \
        packages/plugins/activity/src/_helpers/__tests__/persist-pipeline-steps.test.ts
git commit -m "feat(activity): add persist-pipeline-steps helper"
```

---

## Task 7: `persist-pipeline-complete` Helper (TDD)

**Files:**
- Create: `packages/plugins/activity/src/_helpers/persist-pipeline-complete.ts`
- Create: `packages/plugins/activity/src/_helpers/__tests__/persist-pipeline-complete.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/plugins/activity/src/_helpers/__tests__/persist-pipeline-complete.test.ts
import type { InvokeResult } from "@harness/plugin-contract";
import { describe, expect, it, vi } from "vitest";
import { persistPipelineComplete } from "../persist-pipeline-complete";

const makeDb = () => ({
  message: { create: vi.fn().mockResolvedValue({}) },
});

const makeInvokeResult = (overrides: Partial<InvokeResult> = {}): InvokeResult => ({
  output: "done",
  durationMs: 1234,
  exitCode: 0,
  inputTokens: 100,
  outputTokens: 50,
  ...overrides,
});

describe("persistPipelineComplete", () => {
  it("creates a pipeline_complete status message with metrics", async () => {
    const db = makeDb();
    const result = makeInvokeResult({ durationMs: 800, inputTokens: 200, outputTokens: 75 });

    await persistPipelineComplete(db as never, "thread-1", result);

    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: "thread-1",
        role: "system",
        kind: "status",
        source: "pipeline",
        content: "Pipeline completed",
        metadata: {
          event: "pipeline_complete",
          durationMs: 800,
          inputTokens: 200,
          outputTokens: 75,
        },
      },
    });
  });

  it("uses null for missing token counts", async () => {
    const db = makeDb();
    const result = makeInvokeResult({ inputTokens: undefined, outputTokens: undefined });

    await persistPipelineComplete(db as never, "thread-1", result);

    const call = (db.message.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0].data.metadata).toMatchObject({ inputTokens: null, outputTokens: null });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @harness/plugin-activity test
```
Expected: FAIL

**Step 3: Implement**

```typescript
// packages/plugins/activity/src/_helpers/persist-pipeline-complete.ts
import type { InvokeResult } from "@harness/plugin-contract";
import type { PrismaClient } from "database";

type PersistPipelineComplete = (
  db: PrismaClient,
  threadId: string,
  invokeResult: InvokeResult,
) => Promise<void>;

const persistPipelineComplete: PersistPipelineComplete = async (db, threadId, invokeResult) => {
  await db.message.create({
    data: {
      threadId,
      role: "system",
      kind: "status",
      source: "pipeline",
      content: "Pipeline completed",
      metadata: {
        event: "pipeline_complete",
        durationMs: invokeResult.durationMs,
        inputTokens: invokeResult.inputTokens ?? null,
        outputTokens: invokeResult.outputTokens ?? null,
      },
    },
  });
};

export { persistPipelineComplete };
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @harness/plugin-activity test
```
Expected: PASS

**Step 5: Commit**

```bash
git add packages/plugins/activity/src/_helpers/persist-pipeline-complete.ts \
        packages/plugins/activity/src/_helpers/__tests__/persist-pipeline-complete.test.ts
git commit -m "feat(activity): add persist-pipeline-complete helper"
```

---

## Task 8: Implement Activity Plugin `index.ts` (TDD)

**Files:**
- Modify: `packages/plugins/activity/src/index.ts`
- Create: `packages/plugins/activity/src/__tests__/index.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/plugins/activity/src/__tests__/index.test.ts
import type { InvokeResult, InvokeStreamEvent, PipelineStep, PluginContext } from "@harness/plugin-contract";
import { describe, expect, it, vi } from "vitest";
import { plugin } from "../index";

const makeCtx = (): PluginContext => ({
  db: { message: { create: vi.fn().mockResolvedValue({}) } } as never,
  invoker: {} as never,
  config: {} as never,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  sendToThread: vi.fn(),
  broadcast: vi.fn(),
});

const makeInvokeResult = (overrides: Partial<InvokeResult> = {}): InvokeResult => ({
  output: "result",
  durationMs: 500,
  exitCode: 0,
  ...overrides,
});

describe("activity plugin", () => {
  it("has correct name and version", () => {
    expect(plugin.name).toBe("activity");
    expect(plugin.version).toBe("1.0.0");
  });

  it("registers onPipelineStart and onPipelineComplete hooks", async () => {
    const ctx = makeCtx();
    const hooks = await plugin.register(ctx);
    expect(hooks.onPipelineStart).toBeTypeOf("function");
    expect(hooks.onPipelineComplete).toBeTypeOf("function");
  });

  it("onPipelineStart persists pipeline_start status", async () => {
    const ctx = makeCtx();
    const hooks = await plugin.register(ctx);
    await hooks.onPipelineStart?.("thread-1");

    expect(ctx.db.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "status",
          metadata: expect.objectContaining({ event: "pipeline_start" }),
        }),
      }),
    );
  });

  it("onPipelineComplete persists steps, stream events, and pipeline_complete", async () => {
    const ctx = makeCtx();
    const hooks = await plugin.register(ctx);

    const steps: PipelineStep[] = [{ step: "onMessage", timestamp: 1000 }];
    const events: InvokeStreamEvent[] = [{ type: "thinking", content: "hmm", timestamp: 2000 }];

    await hooks.onPipelineComplete?.("thread-1", {
      invokeResult: makeInvokeResult(),
      pipelineSteps: steps,
      streamEvents: events,
      commandsHandled: [],
    });

    const createCalls = (ctx.db.message.create as ReturnType<typeof vi.fn>).mock.calls as Array<
      [{ data: { kind: string } }]
    >;
    const kinds = createCalls.map((c) => c[0]?.data.kind);
    expect(kinds).toContain("pipeline_step");
    expect(kinds).toContain("thinking");
    expect(kinds).toContain("status"); // pipeline_complete
  });

  it("onPipelineStart suppresses and logs DB errors", async () => {
    const ctx = makeCtx();
    (ctx.db.message.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB down"));
    const hooks = await plugin.register(ctx);

    await expect(hooks.onPipelineStart?.("thread-1")).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalled();
  });

  it("onPipelineComplete suppresses and logs DB errors", async () => {
    const ctx = makeCtx();
    (ctx.db.message.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB down"));
    const hooks = await plugin.register(ctx);

    await expect(
      hooks.onPipelineComplete?.("thread-1", {
        invokeResult: makeInvokeResult(),
        pipelineSteps: [],
        streamEvents: [],
        commandsHandled: [],
      }),
    ).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @harness/plugin-activity test
```
Expected: FAIL — skeleton returns empty hooks

**Step 3: Implement `packages/plugins/activity/src/index.ts`**

```typescript
import type { PluginContext, PluginDefinition, PluginHooks } from "@harness/plugin-contract";
import { persistPipelineComplete } from "./_helpers/persist-pipeline-complete";
import { persistPipelineStart } from "./_helpers/persist-pipeline-start";
import { persistPipelineSteps } from "./_helpers/persist-pipeline-steps";
import { persistStreamEvents } from "./_helpers/persist-stream-events";

type CreateRegister = () => (ctx: PluginContext) => Promise<PluginHooks>;

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info("Activity plugin registered");

    return {
      onPipelineStart: async (threadId) => {
        try {
          await persistPipelineStart(ctx.db, threadId);
        } catch (err) {
          ctx.logger.error(
            `Activity: failed to persist pipeline_start: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },

      onPipelineComplete: async (threadId, { invokeResult, pipelineSteps, streamEvents }) => {
        try {
          await persistPipelineSteps(ctx.db, threadId, pipelineSteps);
          await persistStreamEvents(ctx.db, threadId, streamEvents);
          await persistPipelineComplete(ctx.db, threadId, invokeResult);
        } catch (err) {
          ctx.logger.error(
            `Activity: failed to persist pipeline complete: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    };
  };

  return register;
};

export const plugin: PluginDefinition = {
  name: "activity",
  version: "1.0.0",
  register: createRegister(),
};
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @harness/plugin-activity test
```
Expected: all PASS

**Step 5: Typecheck**

```bash
pnpm --filter @harness/plugin-activity typecheck
```
Expected: no errors

**Step 6: Commit**

```bash
git add packages/plugins/activity/src/index.ts \
        packages/plugins/activity/src/__tests__/index.test.ts
git commit -m "feat(activity): implement activity plugin with onPipelineStart and onPipelineComplete"
```

---

## Task 9: Register Activity Plugin

**Files:**
- Modify: `apps/orchestrator/package.json`
- Modify: `apps/orchestrator/src/plugin-registry/index.ts`

**Step 1: Add `@harness/plugin-activity` to orchestrator dependencies**

In `apps/orchestrator/package.json`, add to `"dependencies"`:

```json
"@harness/plugin-activity": "workspace:*"
```

**Step 2: Run install**

```bash
pnpm install
```

**Step 3: Register in `apps/orchestrator/src/plugin-registry/index.ts`**

Add import alongside other plugin imports:

```typescript
import { plugin as activityPlugin } from "@harness/plugin-activity";
```

Add as first entry in `ALL_PLUGINS`:

```typescript
const ALL_PLUGINS: PluginDefinition[] = [
  activityPlugin,
  contextPlugin,
  discordPlugin,
  webPlugin,
  delegationPlugin,
  metricsPlugin,
  timePlugin,
];
```

**Step 4: Run typecheck**

```bash
pnpm --filter orchestrator typecheck
```
Expected: no errors

**Step 5: Commit**

```bash
git add apps/orchestrator/package.json \
        apps/orchestrator/src/plugin-registry/index.ts
git commit -m "feat(orchestrator): register activity plugin"
```

---

## Task 10: Remove Rich Activity Writes from `sendToThread` (TDD)

**Files:**
- Modify: `apps/orchestrator/src/orchestrator/__tests__/index.test.ts`
- Modify: `apps/orchestrator/src/orchestrator/index.ts`

Update tests first, then implementation.

**Step 1: Update `sendToThread` describe block in the test file**

Find `describe('sendToThread')` (line ~287). Make these changes:

**Keep unchanged:**
- `"runs the message pipeline and persists the assistant response with model"`

**Replace** `"does not persist when invoke returns empty output"` with:

```typescript
it("does not persist when invoke returns empty output", async () => {
  const invokeResult = makeInvokeResult({ output: "" });
  const deps = makeDeps({
    invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
  });
  const orchestrator = createOrchestrator(deps);

  await orchestrator.getContext().sendToThread("thread-1", "hello");

  expect(deps.db.message.create as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  expect(deps.db.thread.update as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
});
```

**Delete entirely** (these move to activity plugin tests):
- `"persists thinking stream events as kind:thinking messages"`
- `"persists tool_call stream events as kind:tool_call messages"`
- `"persists tool_use_summary stream events as kind:tool_result messages"`

**Add** these new tests at the end of the `describe('sendToThread')` block:

> **Note on the mock:** `runNotifyHooks` is globally mocked at line 29 — it never invokes the callHook lambda. Do NOT assert on the plugin hook function itself being called. Assert on `mockRunNotifyHooks` being called with the right `hookName` string. Also note `makePluginDefinition` signature: `(name: string, hooks: PluginHooks, overrides?)` — hooks go in the second arg.

```typescript
it("calls runNotifyHooks with onPipelineStart before the pipeline runs", async () => {
  const deps = makeDeps();
  createOrchestrator(deps);

  // runNotifyHooks is mocked — assert it was called with the correct hookName
  expect(mockRunNotifyHooks).toHaveBeenCalledWith(
    expect.any(Array),
    "onPipelineStart",
    expect.any(Function),
    expect.anything(),
  );
});

it("calls runNotifyHooks with onPipelineComplete after the pipeline runs", async () => {
  const deps = makeDeps();
  const orchestrator = createOrchestrator(deps);

  await orchestrator.getContext().sendToThread("thread-1", "hello");

  expect(mockRunNotifyHooks).toHaveBeenCalledWith(
    expect.any(Array),
    "onPipelineComplete",
    expect.any(Function),
    expect.anything(),
  );
});
```

**Step 2: Run tests to verify failures are as expected**

```bash
pnpm --filter orchestrator test -- --testPathPattern="orchestrator/__tests__/index"
```
Expected: new hook call tests FAIL, deleted tests gone, kept tests still pass

**Step 3: Update `apps/orchestrator/src/orchestrator/index.ts`**

Remove `PipelineStep` type definition (lines 28–32) — it's now imported from plugin-contract. Add it to the import from `@harness/plugin-contract`:

```typescript
import type { InvokeOptions, InvokeStreamEvent, PipelineStep, PluginContext, PluginDefinition, PluginHooks } from "@harness/plugin-contract";
```

Replace `sendToThread` closure (lines 67–159) with:

```typescript
sendToThread: async (threadId: string, content: string) => {
  if (!pipeline.handleMessage) {
    throw new Error("Orchestrator not fully initialized");
  }

  deps.logger.info(`sendToThread: starting [thread=${threadId}, contentLength=${content.length}]`);

  // Notify plugins pipeline is starting
  await runNotifyHooks(allHooks(), "onPipelineStart", (h) => h.onPipelineStart?.(threadId), deps.logger);

  const result = await pipeline.handleMessage(threadId, "user", content);
  const { invokeResult, pipelineSteps, streamEvents, commandsHandled } = result;

  // Notify plugins pipeline is complete BEFORE innate writes.
  // This ensures thinking/tool_call/tool_result records get earlier createdAt than
  // assistant_text — message-list.tsx sorts by createdAt: 'asc', so order matters for UI.
  await runNotifyHooks(
    allHooks(),
    "onPipelineComplete",
    (h) => h.onPipelineComplete?.(threadId, { invokeResult, pipelineSteps, streamEvents, commandsHandled }),
    deps.logger,
  );

  // INNATE: Persist assistant text reply and update thread activity (after activity plugin
  // so the reply appears after thinking/tool records in the sorted message list)
  if (invokeResult.output) {
    deps.logger.info(
      `sendToThread: persisting assistant response [thread=${threadId}, outputLength=${invokeResult.output.length}]`,
    );
    await deps.db.message.create({
      data: {
        threadId,
        role: "assistant",
        kind: "text",
        source: "builtin",
        content: invokeResult.output,
        model: invokeResult.model,
      },
    });
    await deps.db.thread.update({
      where: { id: threadId },
      data: { lastActivity: new Date() },
    });
  } else {
    deps.logger.warn(
      `sendToThread: no output from pipeline [thread=${threadId}, error=${invokeResult.error ?? "none"}, exit=${invokeResult.exitCode}]`,
    );
  }
},
```

Also remove the `import { parsePluginSource }` line at the top of the file — it is no longer used.

**Step 4: Run tests**

```bash
pnpm --filter orchestrator test -- --testPathPattern="orchestrator/__tests__/index"
```
Expected: all PASS

**Step 5: Run full orchestrator test suite**

```bash
pnpm --filter orchestrator test
```
Expected: all PASS

**Step 6: Commit**

```bash
git add apps/orchestrator/src/orchestrator/index.ts \
        apps/orchestrator/src/orchestrator/__tests__/index.test.ts
git commit -m "refactor(orchestrator): move Rich Activity persistence out of sendToThread into activity plugin"
```

---

## Task 11: Remove `parse-plugin-source` from Orchestrator

**Files:**
- Delete: `apps/orchestrator/src/orchestrator/_helpers/parse-plugin-source.ts`
- Delete: `apps/orchestrator/src/orchestrator/_helpers/__tests__/parse-plugin-source.test.ts`

**Step 1: Verify no remaining references**

```bash
grep -r "parsePluginSource" apps/orchestrator/src/
```
Expected: no output

**Step 2: Delete the files**

```bash
rm apps/orchestrator/src/orchestrator/_helpers/parse-plugin-source.ts
rm apps/orchestrator/src/orchestrator/_helpers/__tests__/parse-plugin-source.test.ts
```

**Step 3: Run orchestrator tests and typecheck**

```bash
pnpm --filter orchestrator test && pnpm --filter orchestrator typecheck
```
Expected: all PASS, no errors

**Step 4: Commit**

```bash
git add -A
git commit -m "chore(orchestrator): remove parse-plugin-source (now owned by activity plugin)"
```

---

## Task 12: Final Verification

**Step 1: Run full test suite**

```bash
pnpm test
```
Expected: all tests pass across all packages

**Step 2: Run full typecheck**

```bash
pnpm typecheck
```
Expected: no errors

**Step 3: Run lint**

```bash
pnpm lint
```
Expected: no errors

**Step 4: Confirm architectural invariant resolved**

```bash
grep -n "pipeline_start\|pipeline_step\|pipeline_complete\|kind.*thinking\|kind.*tool_call\|kind.*tool_result" \
  apps/orchestrator/src/orchestrator/index.ts
```
Expected: no output — all Rich Activity writes live exclusively in the activity plugin now

**Step 5: Final commit if any fixups remain**

```bash
git add -A
git commit -m "chore: finalize activity plugin refactor"
```

---

## Summary of All Changes

| File | Change |
|------|--------|
| `packages/plugin-contract/src/index.ts` | Add `PipelineStep` type + `onPipelineStart`/`onPipelineComplete` hooks to `PluginHooks` |
| `packages/plugins/activity/package.json` | **New** — package manifest |
| `packages/plugins/activity/tsconfig.json` | **New** — TypeScript config |
| `packages/plugins/activity/vitest.config.ts` | **New** — test config |
| `packages/plugins/activity/src/index.ts` | **New** — plugin definition, `onPipelineStart` + `onPipelineComplete` |
| `packages/plugins/activity/src/_helpers/parse-plugin-source.ts` | **New** — moved from orchestrator |
| `packages/plugins/activity/src/_helpers/persist-pipeline-start.ts` | **New** |
| `packages/plugins/activity/src/_helpers/persist-stream-events.ts` | **New** |
| `packages/plugins/activity/src/_helpers/persist-pipeline-steps.ts` | **New** |
| `packages/plugins/activity/src/_helpers/persist-pipeline-complete.ts` | **New** |
| `apps/orchestrator/package.json` | Add `@harness/plugin-activity` dependency |
| `apps/orchestrator/src/plugin-registry/index.ts` | Register `activityPlugin` |
| `apps/orchestrator/src/orchestrator/index.ts` | Remove `PipelineStep` def + Rich Activity writes; add hook calls; ~90 lines → ~35 lines |
| `apps/orchestrator/src/orchestrator/__tests__/index.test.ts` | Remove 3 Rich Activity tests; add 2 hook call tests; simplify empty-output test |
| `apps/orchestrator/src/orchestrator/_helpers/parse-plugin-source.ts` | **Deleted** |
| `apps/orchestrator/src/orchestrator/_helpers/__tests__/parse-plugin-source.test.ts` | **Deleted** |

**Net result:** `sendToThread` shrinks from ~90 lines to ~35. All Rich Activity persistence lives in a proper, testable, disableable plugin. The architectural violation documented in `.claude/rules/architectural-invariants.md` is fully resolved.

**DB write order after refactor** (compared to current):
- `pipeline_start` — same position (before pipeline)
- `pipeline_steps` / `stream_events` / `pipeline_complete` — same relative order, now via plugin
- `assistant_text` — moved to after `pipeline_complete` (was before it); thinking/tool records still precede assistant_text ✓
- `parsePluginSource` regex fixed: `/^(\w+?)__/` correctly matches `delegation__delegate`; the old `/^(\w+?)Plugin__/` was silently broken
