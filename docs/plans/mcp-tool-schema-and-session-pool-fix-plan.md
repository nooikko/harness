# MCP Tool Schema + Session Pool Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two bugs: (1) MCP tool calls silently fail because plain JSON Schema objects can't be used as Zod schemas by the SDK validator; (2) the session pool never reuses warm subprocesses because it is keyed by a value that changes after every invocation.

**Architecture:** Fix 1 adds a `jsonSchemaToZodShape` helper to `tool-server/index.ts` that converts the plugin contract's JSON Schema format to a Zod raw shape before passing it to the SDK. Fix 2 adds `threadId` to `InvokeOptions` (the stable harness thread ID) and uses it as the session pool key instead of `sessionId` (the Claude session ID, which changes every invocation). `Invoker.prewarm` is also corrected to accept `{ threadId }` instead of `{ sessionId }` so the contract matches the usage.

**Tech Stack:** TypeScript, Zod 4 (`z` from `zod`), Vitest, `@anthropic-ai/claude-agent-sdk`

---

## Background

### Why the tool call fails

`createToolServer` in `tool-server/index.ts` passes `t.schema` (a plain JSON Schema object like `{ type: 'object', properties: {} }`) directly as `inputSchema` for `SdkMcpToolDefinition`. The SDK type signature expects a Zod raw shape (`AnyZodRawShape`). At tool call time the SDK's `McpServer.validateToolInput()` calls `g6(inputSchema)` which returns `undefined` for plain objects, then falls back to calling `.safeParseAsync()` directly on the plain object — which throws `TypeError: Q.safeParseAsync is not a function`. The SDK catches this and returns it to Claude as `{ isError: true }`. Nothing appears in orchestrator logs.

The fix: convert JSON Schema → Zod shape at the boundary. Plugin contract stays as JSON Schema.

### Why the session pool never hits

`invoker-sdk/index.ts:55`:
```typescript
const threadId = options?.sessionId ?? 'default';  // WRONG: reads Claude session ID
```

`invoker.prewarm()` in `packages/plugins/web/src/_helpers/routes.ts:84`:
```typescript
ctx.invoker.prewarm({ sessionId: body.threadId, model });  // passes harness thread ID
```

Pre-warm keys by harness thread ID (e.g. `"cmlzx4p9900009yoab67f3l4i"`). Every `invoke()` call keys by Claude session ID (e.g. `"c631e231-15d9-418c-b0c6-a8a0bf95a946"`). These never match. Every message gets a cold subprocess. The variable is even named `threadId` in invoker-sdk but reads from `sessionId` — a clear wiring bug.

Secondary correctness impact: the context plugin skips history injection when `thread.sessionId` is non-null (assuming session is warm). Since the pool always misses, Claude starts fresh every message without history.

The fix: add `threadId` to `InvokeOptions` and use it as the pool key. Also fix `Invoker.prewarm` to use `{ threadId }` instead of `{ sessionId }` to eliminate the naming ambiguity that caused the original wiring mistake.

---

## Task 1: Add Zod as a direct dependency

**Files:**
- Modify: `apps/orchestrator/package.json` (via pnpm)

### Step 1: Add the dependency with version pin

```bash
pnpm --filter orchestrator add zod@^4
```

Expected: zod appears in `apps/orchestrator/package.json` under `dependencies` with a `^4.x.x` version.

### Step 2: Verify install

```bash
pnpm --filter orchestrator typecheck
```

Expected: no new errors.

### Step 3: Commit

```bash
git add apps/orchestrator/package.json pnpm-lock.yaml
git commit -m "chore(orchestrator): add zod@^4 as direct dependency"
```

---

## Task 2: `jsonSchemaToZodShape` — write failing tests first

**Files:**
- Create: `apps/orchestrator/src/tool-server/_helpers/json-schema-to-zod-shape.ts`
- Create: `apps/orchestrator/src/tool-server/_helpers/__tests__/json-schema-to-zod-shape.test.ts`

The function signature:
```typescript
import type { ZodTypeAny } from 'zod';
type JsonSchemaToZodShape = (schema: Record<string, unknown>) => Record<string, ZodTypeAny>;
```

### Step 1: Write the failing tests

Create `apps/orchestrator/src/tool-server/_helpers/__tests__/json-schema-to-zod-shape.test.ts`:

```typescript
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { jsonSchemaToZodShape } from '../json-schema-to-zod-shape';

describe('jsonSchemaToZodShape', () => {
  it('returns empty shape for schema with no properties', () => {
    const result = jsonSchemaToZodShape({ type: 'object', properties: {} });
    expect(result).toEqual({});
  });

  it('returns empty shape when properties key is absent', () => {
    const result = jsonSchemaToZodShape({ type: 'object' });
    expect(result).toEqual({});
  });

  it('maps string type to z.string()', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    });
    expect(result.name).toBeDefined();
    expect(() => z.object(result).parse({ name: 'hello' })).not.toThrow();
    expect(() => z.object(result).parse({ name: 42 })).toThrow();
  });

  it('maps number type to z.number()', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { count: { type: 'number' } },
      required: ['count'],
    });
    expect(() => z.object(result).parse({ count: 5 })).not.toThrow();
    expect(() => z.object(result).parse({ count: 'five' })).toThrow();
  });

  it('maps integer type to z.number().int()', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { count: { type: 'integer' } },
      required: ['count'],
    });
    expect(() => z.object(result).parse({ count: 5 })).not.toThrow();
    expect(() => z.object(result).parse({ count: 5.5 })).toThrow();
    expect(() => z.object(result).parse({ count: 'five' })).toThrow();
  });

  it('maps boolean type to z.boolean()', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { active: { type: 'boolean' } },
      required: ['active'],
    });
    expect(() => z.object(result).parse({ active: true })).not.toThrow();
    expect(() => z.object(result).parse({ active: 'yes' })).toThrow();
  });

  it('maps unknown type to z.unknown() — accepts any value including undefined', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { data: { type: 'object' } },
      required: ['data'],
    });
    // z.unknown() accepts any value — limitation: presence is not enforced for complex types
    expect(() => z.object(result).parse({ data: { nested: true } })).not.toThrow();
    expect(() => z.object(result).parse({ data: 'string' })).not.toThrow();
    expect(() => z.object(result).parse({ data: undefined })).not.toThrow();
  });

  it('maps field without a type to z.unknown()', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { anything: { description: 'no type' } },
      required: ['anything'],
    });
    expect(() => z.object(result).parse({ anything: 42 })).not.toThrow();
  });

  it('makes fields optional when not in required array', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: {
        required_field: { type: 'string' },
        optional_field: { type: 'string' },
      },
      required: ['required_field'],
    });
    expect(() => z.object(result).parse({ required_field: 'hello' })).not.toThrow();
    expect(() => z.object(result).parse({})).toThrow(); // required_field missing
    expect(() => z.object(result).parse({ required_field: 'hi', optional_field: 'bye' })).not.toThrow();
  });

  it('makes all fields optional when required array is absent', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { name: { type: 'string' } },
    });
    expect(() => z.object(result).parse({})).not.toThrow();
  });

  it('handles multiple properties of mixed types', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Task prompt' },
        model: { type: 'string', description: 'Model override' },
        maxIterations: { type: 'number', description: 'Max tries' },
      },
      required: ['prompt'],
    });
    expect(() =>
      z.object(result).parse({ prompt: 'do the thing', model: 'sonnet', maxIterations: 5 }),
    ).not.toThrow();
    expect(() => z.object(result).parse({ prompt: 'minimal' })).not.toThrow();
    expect(() => z.object(result).parse({})).toThrow(); // prompt required
  });
});
```

### Step 2: Run tests to verify they fail

```bash
pnpm --filter orchestrator test src/tool-server/_helpers/__tests__/json-schema-to-zod-shape.test.ts
```

Expected: FAIL — `Cannot find module '../json-schema-to-zod-shape'`

### Step 3: Implement the helper

Create `apps/orchestrator/src/tool-server/_helpers/json-schema-to-zod-shape.ts`:

```typescript
import { z, type ZodTypeAny } from 'zod';

type JsonSchemaProperty = {
  type?: string;
};

type JsonSchemaToZodShape = (schema: Record<string, unknown>) => Record<string, ZodTypeAny>;

export const jsonSchemaToZodShape: JsonSchemaToZodShape = (schema) => {
  const properties = schema.properties as Record<string, JsonSchemaProperty> | undefined;
  const required = (schema.required as string[] | undefined) ?? [];

  if (!properties || Object.keys(properties).length === 0) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(properties).map(([key, prop]) => {
      let base: ZodTypeAny;

      switch (prop.type) {
        case 'string':
          base = z.string();
          break;
        case 'number':
          base = z.number();
          break;
        case 'integer':
          base = z.number().int();
          break;
        case 'boolean':
          base = z.boolean();
          break;
        default:
          // NOTE: z.unknown() accepts any value including undefined, so required fields
          // of complex types (object, array) will pass validation even when absent.
          // Full JSON Schema support (nested objects, arrays, enums) is out of scope here.
          base = z.unknown();
          break;
      }

      return [key, required.includes(key) ? base : base.optional()];
    }),
  );
};
```

### Step 4: Run tests to verify they pass

```bash
pnpm --filter orchestrator test src/tool-server/_helpers/__tests__/json-schema-to-zod-shape.test.ts
```

Expected: all tests PASS.

### Step 5: Commit

```bash
git add apps/orchestrator/src/tool-server/_helpers/json-schema-to-zod-shape.ts \
        apps/orchestrator/src/tool-server/_helpers/__tests__/json-schema-to-zod-shape.test.ts
git commit -m "feat(orchestrator): add jsonSchemaToZodShape helper for MCP tool schema conversion"
```

---

## Task 3: Wire `jsonSchemaToZodShape` into `createToolServer`

**Files:**
- Modify: `apps/orchestrator/src/tool-server/index.ts`
- Modify: `apps/orchestrator/src/tool-server/__tests__/index.test.ts`

### Step 1: Add a positive assertion test for Zod shape in the existing test file

In `apps/orchestrator/src/tool-server/__tests__/index.test.ts`, add a new test in the `createToolServer` describe block:

```typescript
it('passes a Zod shape (not raw JSON Schema) as inputSchema', () => {
  const tool = makeTool('delegate');
  // makeTool uses schema: { type: 'object', properties: { input: { type: 'string' } } }
  const collected = [{ ...tool, pluginName: 'delegation', qualifiedName: 'delegation__delegate' }];

  createToolServer(collected, makeContextRef());

  const callArgs = mockCreateSdkMcpServer.mock.calls[0]![0];
  const passedTool = callArgs.tools[0] as { inputSchema: Record<string, unknown> };

  // POSITIVE: the Zod shape must have the 'input' key from the schema properties
  expect(passedTool.inputSchema).toHaveProperty('input');

  // NEGATIVE: inputSchema must NOT be the raw JSON Schema (which would cause safeParseAsync TypeError)
  expect(passedTool.inputSchema).not.toHaveProperty('type', 'object');
  expect(passedTool.inputSchema).not.toHaveProperty('properties');
});
```

### Step 2: Run the new test to verify it fails

```bash
pnpm --filter orchestrator test src/tool-server/__tests__/index.test.ts
```

Expected: the new test FAILS (current code passes raw JSON Schema through).

### Step 3: Update `tool-server/index.ts`

Read `apps/orchestrator/src/tool-server/index.ts` first. Then make two changes:

**Add the import** at the top of the file:
```typescript
import type { ZodTypeAny } from 'zod';
import { jsonSchemaToZodShape } from './_helpers/json-schema-to-zod-shape';
```

**Replace line 41** (the `inputSchema` line):
```typescript
// BEFORE:
inputSchema: t.schema as Record<string, never>,

// AFTER:
inputSchema: jsonSchemaToZodShape(t.schema) as Record<string, ZodTypeAny>,
```

The type argument changes from `Record<string, never>` to `Record<string, ZodTypeAny>` — the former was a suppression cast, the latter reflects the actual return type of `jsonSchemaToZodShape`.

**Replace the incorrect comment block** on lines 34–37 (the one that claims "plain JSON Schema objects work correctly at runtime") with:
```typescript
// Convert the plugin's JSON Schema to a Zod raw shape. The SDK uses Zod internally
// to validate tool inputs at call time; plain JSON Schema objects cause a TypeError
// because the SDK calls .safeParseAsync() on whatever is passed as inputSchema.
// jsonSchemaToZodShape maps primitive types (string/number/integer/boolean) to Zod
// equivalents and falls back to z.unknown() for complex/nested types.
```

### Step 4: Run all tool-server tests

```bash
pnpm --filter orchestrator test src/tool-server
```

Expected: all tests PASS including the new one.

### Step 5: Commit

```bash
git add apps/orchestrator/src/tool-server/index.ts \
        apps/orchestrator/src/tool-server/__tests__/index.test.ts
git commit -m "fix(orchestrator): convert JSON Schema to Zod shape in createToolServer — fixes MCP tool call TypeError"
```

---

## Task 4: Fix `InvokeOptions` and `Invoker.prewarm` in plugin-contract

**Files:**
- Modify: `packages/plugin-contract/src/index.ts`

Two changes in the same file. Both are additive or correctional — no downstream code breaks without being updated.

### Step 1: Add `threadId` to `InvokeOptions`

In `packages/plugin-contract/src/index.ts`, find `InvokeOptions` (around line 48) and add `threadId`:

```typescript
export type InvokeOptions = {
  model?: string;
  timeout?: number;
  allowedTools?: string[];
  maxTokens?: number;
  sessionId?: string;
  threadId?: string;  // Harness thread ID — used as session pool key (stable across messages)
  onMessage?: (event: InvokeStreamEvent) => void;
};
```

### Step 2: Fix `Invoker.prewarm` parameter type

In the same file, find the `Invoker` type (around line 68) and fix the `prewarm` signature:

```typescript
// BEFORE:
prewarm?(opts: { sessionId: string; model?: string }): void;

// AFTER:
prewarm?(opts: { threadId: string; model?: string }): void;
```

The old type accepted `{ sessionId }` but callers passed harness thread IDs — the name was semantically wrong. Renaming to `threadId` eliminates the ambiguity that caused the original wiring mistake.

### Step 3: Typecheck to surface all affected call sites

```bash
pnpm typecheck
```

Expected: errors at `routes.ts` (calls `prewarm({ sessionId: ... })`) and `invoker-sdk/index.ts` (prewarm implementation uses `options.sessionId`). These will be fixed in Task 6.

### Step 4: Commit

```bash
git add packages/plugin-contract/src/index.ts
git commit -m "feat(plugin-contract): add threadId to InvokeOptions; fix Invoker.prewarm to use threadId"
```

---

## Task 5: Pass `threadId` in orchestrator `handleMessage`

**Files:**
- Modify: `apps/orchestrator/src/orchestrator/index.ts`

### Step 1: Find the invoke call

In `apps/orchestrator/src/orchestrator/index.ts`, find line ~197:

```typescript
const invokeResult = await deps.invoker.invoke(prompt, { model, sessionId, onMessage: (event) => streamEvents.push(event) });
```

### Step 2: Add `threadId` to the invoke options

```typescript
const invokeResult = await deps.invoker.invoke(prompt, { model, sessionId, threadId, onMessage: (event) => streamEvents.push(event) });
```

`threadId` is already in scope at this call site (it is the first parameter of `handleMessage`).

### Step 3: Typecheck

```bash
pnpm --filter orchestrator typecheck
```

Expected: no errors.

### Step 4: Commit

```bash
git add apps/orchestrator/src/orchestrator/index.ts
git commit -m "fix(orchestrator): pass threadId to invoker for correct session pool keying"
```

---

## Task 6: Use `threadId` as pool key in `invoker-sdk` + fix `prewarm` + fix `routes.ts`

**Files:**
- Modify: `apps/orchestrator/src/invoker-sdk/index.ts`
- Modify: `apps/orchestrator/src/invoker-sdk/__tests__/index.test.ts`
- Modify: `packages/plugins/web/src/_helpers/routes.ts`

### Step 1: Update the test file first

In `apps/orchestrator/src/invoker-sdk/__tests__/index.test.ts`:

**Rename the test** at line 130: change `'uses sessionId as pool key when provided'` to `'falls back to sessionId as pool key when threadId is absent'`. The assertion body stays the same.

**Add a new threadId priority test** after it:

```typescript
it('uses threadId as pool key when provided, ignoring sessionId', async () => {
  const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

  await invoker.invoke('hello', { threadId: 'thread-stable', sessionId: 'sess-changes-every-time' });

  expect(mockPool.get).toHaveBeenCalledWith('thread-stable', 'haiku');
});
```

**Add an evict-with-threadId test:**

```typescript
it('evicts using threadId when provided', async () => {
  vi.mocked(mockSession.send).mockRejectedValue(new Error('boom'));
  const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

  await invoker.invoke('hello', { threadId: 'thread-stable', sessionId: 'sess-xyz' });

  expect(mockPool.evict).toHaveBeenCalledWith('thread-stable');
});
```

**Update the two prewarm tests** (lines 220–235) to use `{ threadId }` instead of `{ sessionId }`:

```typescript
it('prewarm creates a session in the pool', () => {
  const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

  invoker.prewarm({ threadId: 'thread-warm', model: 'sonnet' });  // was: { sessionId: ... }

  expect(mockPool.get).toHaveBeenCalledWith('thread-warm', 'sonnet');
  expect(mockSession.send).not.toHaveBeenCalled();
});

it('prewarm uses default model when not specified', () => {
  const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

  invoker.prewarm({ threadId: 'thread-warm-default' });  // was: { sessionId: ... }

  expect(mockPool.get).toHaveBeenCalledWith('thread-warm-default', 'haiku');
});
```

**Add a prewarm+invoke alignment test** to confirm they share the same pool key:

```typescript
it('prewarm and invoke use the same pool key for the same threadId', async () => {
  const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

  invoker.prewarm({ threadId: 'thread-abc' });
  await invoker.invoke('hello', { threadId: 'thread-abc' });

  const calls = vi.mocked(mockPool.get).mock.calls;
  expect(calls[0]![0]).toBe('thread-abc');  // prewarm call
  expect(calls[1]![0]).toBe('thread-abc');  // invoke call — same key
});
```

### Step 2: Run tests to verify new/updated tests fail

```bash
pnpm --filter orchestrator test src/invoker-sdk/__tests__/index.test.ts
```

Expected: the new threadId tests FAIL; the prewarm tests FAIL (wrong param name).

### Step 3: Update `invoker-sdk/index.ts`

Read `apps/orchestrator/src/invoker-sdk/index.ts` first. Make the following changes:

**In the `invoke` function**, replace line ~55:
```typescript
// BEFORE:
const threadId = options?.sessionId ?? 'default';

// AFTER:
const poolKey = options?.threadId ?? options?.sessionId ?? 'default';
```

Replace all subsequent uses of the pool-key variable (`threadId`) in the `invoke` function with `poolKey`:
```typescript
// BEFORE:
const session = pool.get(threadId, model);
// ...
pool.evict(threadId);

// AFTER:
const session = pool.get(poolKey, model);
// ...
pool.evict(poolKey);
```

> The local variable was misleadingly named `threadId` but held the Claude session ID. Renaming it `poolKey` makes the intent clear and avoids shadowing with `options.threadId`.

**In the `prewarm` function** (lines ~85–88), update the parameter type and usage:
```typescript
// BEFORE:
const prewarm = (options: { sessionId: string; model?: string }): void => {
  const model = options.model ?? config.defaultModel;
  pool.get(options.sessionId, model);
};

// AFTER:
const prewarm = (options: { threadId: string; model?: string }): void => {
  const model = options.model ?? config.defaultModel;
  pool.get(options.threadId, model);
};
```

### Step 4: Fix `routes.ts` call site

In `packages/plugins/web/src/_helpers/routes.ts`, find line ~84:

```typescript
// BEFORE:
ctx.invoker.prewarm({ sessionId: body.threadId, model });

// AFTER:
ctx.invoker.prewarm({ threadId: body.threadId, model });
```

### Step 5: Run all invoker-sdk tests

```bash
pnpm --filter orchestrator test src/invoker-sdk
```

Expected: all tests PASS.

### Step 6: Typecheck

```bash
pnpm typecheck
```

Expected: no errors.

### Step 7: Commit

```bash
git add apps/orchestrator/src/invoker-sdk/index.ts \
        apps/orchestrator/src/invoker-sdk/__tests__/index.test.ts \
        packages/plugins/web/src/_helpers/routes.ts
git commit -m "fix(orchestrator): use threadId as session pool key — pool now correctly reuses warm subprocesses"
```

---

## Task 7: Fix delegation `invokeSubAgent` to pass `threadId`

**Files:**
- Modify: `packages/plugins/delegation/src/_helpers/invoke-sub-agent.ts`
- Modify: `packages/plugins/delegation/src/_helpers/__tests__/invoke-sub-agent.test.ts`

The delegation plugin creates sub-agent threads. Each `invokeSubAgent` call has a `threadId` in scope (the sub-agent's thread ID) but never passes it to `ctx.invoker.invoke`. Without it, all sub-agents share the `'default'` pool key — they can clobber each other's sessions and will never be warm on subsequent calls.

### Step 1: Read the source file

Read `packages/plugins/delegation/src/_helpers/invoke-sub-agent.ts` to understand the current call site. The `threadId` parameter (the sub-agent's thread ID) is already in scope at line ~12.

### Step 2: Update the test file first

Read `packages/plugins/delegation/src/_helpers/__tests__/invoke-sub-agent.test.ts`. Find every `toHaveBeenCalledWith` assertion on `ctx.invoker.invoke` and add `threadId` to the expected options. The test's `threadId` value is whatever thread ID the test uses for the sub-agent (likely `'thread-1'` or similar — match what the test already uses).

Example: if the test currently has:
```typescript
expect(ctx.invoker.invoke).toHaveBeenCalledWith(prompt, { model: 'haiku', onMessage: expect.any(Function) });
```

Update to:
```typescript
expect(ctx.invoker.invoke).toHaveBeenCalledWith(prompt, { model: 'haiku', threadId: 'thread-1', onMessage: expect.any(Function) });
```

(Use the actual `threadId` value in scope in each test.)

### Step 3: Run tests to verify they fail

```bash
pnpm --filter delegation test
```

Expected: FAIL — `threadId` not in the actual call.

### Step 4: Update `invoke-sub-agent.ts`

Find the `ctx.invoker.invoke(prompt, { model, onMessage })` call and add `threadId`:

```typescript
// BEFORE:
ctx.invoker.invoke(prompt, { model, onMessage })

// AFTER:
ctx.invoker.invoke(prompt, { model, threadId, onMessage })
```

`threadId` is the sub-agent thread ID already in scope as a parameter.

### Step 5: Run delegation tests

```bash
pnpm --filter delegation test
```

Expected: all tests PASS.

### Step 6: Commit

```bash
git add packages/plugins/delegation/src/_helpers/invoke-sub-agent.ts \
        packages/plugins/delegation/src/_helpers/__tests__/invoke-sub-agent.test.ts
git commit -m "fix(delegation): pass threadId to invoker in invokeSubAgent — sub-agents now use correct pool key"
```

---

## Task 8: Full test suite + typecheck

### Step 1: Run full test suite

```bash
pnpm test
```

Expected: all tests pass.

### Step 2: Typecheck entire monorepo

```bash
pnpm typecheck
```

Expected: no errors.

### Step 3: Run lint

```bash
pnpm lint
```

Expected: no errors.

---

## Verification

After all tasks are complete, to manually verify in a running system:

1. Start the orchestrator: `pnpm dev`
2. Send a message that asks "what time is it?" in a chat thread
3. The pipeline should show `harness__time__current_time` called successfully (no error in Claude's response)
4. Send a second message in the same thread
5. Logs should show `sessionId=` in the second invoke is the same pool entry (reflected in faster response time — no cold subprocess startup)
