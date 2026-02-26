# Plugin Tool Registration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable plugins to register structured tools that Claude discovers and invokes natively via MCP, replacing text-parsed slash commands.

**Architecture:** Plugins define tools (name, description, Zod schema, handler) on their `PluginDefinition`. At boot, the orchestrator collects all plugin tools, creates an in-process MCP server via `createSdkMcpServer()`, and passes it to every `query()` invocation. Claude sees tools as structured `tool_use` entries.

**Tech Stack:** `@anthropic-ai/claude-agent-sdk` (createSdkMcpServer, tool), Zod for schemas, Vitest for tests.

---

### Task 1: Add PluginTool types to plugin-contract

**Files:**
- Modify: `packages/plugin-contract/src/index.ts`
- Test: `packages/plugin-contract/src/__tests__/index.test.ts` (if exists, otherwise skip — types are validated at compile time)

**Step 1: Add PluginTool and PluginToolHandler types**

Add these types after the existing `PluginHooks` type in `packages/plugin-contract/src/index.ts`:

```typescript
export type PluginToolMeta = {
  threadId: string;
  taskId?: string;
};

export type PluginToolHandler = (
  ctx: PluginContext,
  input: Record<string, unknown>,
  meta: PluginToolMeta,
) => Promise<string>;

export type PluginTool = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: PluginToolHandler;
};
```

**Step 2: Add optional `tools` to PluginDefinition**

In the same file, add `tools?: PluginTool[];` to `PluginDefinition`:

```typescript
export type PluginDefinition = {
  name: string;
  version: string;
  register: RegisterFn;
  start?: StartFn;
  stop?: StopFn;
  tools?: PluginTool[];
};
```

**Step 3: Run typecheck to verify no breaks**

Run: `pnpm typecheck`
Expected: PASS — the new field is optional, no existing code breaks.

**Step 4: Commit**

```bash
git add packages/plugin-contract/src/index.ts
git commit -m "feat(plugin-contract): add PluginTool types to PluginDefinition"
```

---

### Task 2: Validate tools in plugin loader

**Files:**
- Modify: `apps/orchestrator/src/plugin-loader/_helpers/validate-plugin.ts`
- Test: `apps/orchestrator/src/plugin-loader/_helpers/__tests__/validate-plugin.test.ts`

**Step 1: Write failing tests for tool validation**

Add these tests to the existing test file after the current `describe` blocks:

```typescript
describe('tools validation', () => {
  it('accepts a plugin with no tools array', () => {
    const plugin = makeValidPlugin();
    const result = validatePluginExport({ default: plugin }, '/path/to/plugin');
    expect(result.valid).toBe(true);
  });

  it('accepts a plugin with a valid tools array', () => {
    const plugin = {
      ...makeValidPlugin(),
      tools: [
        {
          name: 'my-tool',
          description: 'Does a thing',
          schema: { type: 'object', properties: {} },
          handler: async () => 'result',
        },
      ],
    };
    const result = validatePluginExport({ default: plugin }, '/path/to/plugin');
    expect(result.valid).toBe(true);
  });

  it('accepts a plugin with an empty tools array', () => {
    const plugin = {
      ...makeValidPlugin(),
      tools: [],
    };
    const result = validatePluginExport({ default: plugin }, '/path/to/plugin');
    expect(result.valid).toBe(true);
  });

  it('rejects tools that is not an array', () => {
    const plugin = {
      ...makeValidPlugin(),
      tools: 'not-an-array',
    };
    const result = validatePluginExport({ default: plugin }, '/path/to/plugin');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toContain('tools');
    }
  });

  it('rejects a tool missing name', () => {
    const plugin = {
      ...makeValidPlugin(),
      tools: [{ description: 'Desc', schema: {}, handler: async () => 'ok' }],
    };
    const result = validatePluginExport({ default: plugin }, '/path/to/plugin');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toContain('name');
    }
  });

  it('rejects a tool missing description', () => {
    const plugin = {
      ...makeValidPlugin(),
      tools: [{ name: 'tool', schema: {}, handler: async () => 'ok' }],
    };
    const result = validatePluginExport({ default: plugin }, '/path/to/plugin');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toContain('description');
    }
  });

  it('rejects a tool missing handler', () => {
    const plugin = {
      ...makeValidPlugin(),
      tools: [{ name: 'tool', description: 'Desc', schema: {} }],
    };
    const result = validatePluginExport({ default: plugin }, '/path/to/plugin');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toContain('handler');
    }
  });

  it('rejects a tool with non-function handler', () => {
    const plugin = {
      ...makeValidPlugin(),
      tools: [{ name: 'tool', description: 'Desc', schema: {}, handler: 'not-fn' }],
    };
    const result = validatePluginExport({ default: plugin }, '/path/to/plugin');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]).toContain('handler');
    }
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter orchestrator test -- src/plugin-loader/_helpers/__tests__/validate-plugin.test.ts`
Expected: FAIL — the new tool validation tests fail because validation logic doesn't exist yet.

**Step 3: Implement tool validation**

In `validate-plugin.ts`, add tool validation after the `stop` check (before the `errors.length` check):

```typescript
if (candidate.tools !== undefined) {
  if (!Array.isArray(candidate.tools)) {
    errors.push(`${modulePath}: Invalid "tools" (expected array or undefined).`);
  } else {
    for (let i = 0; i < candidate.tools.length; i++) {
      const t = candidate.tools[i] as Record<string, unknown>;
      if (typeof t.name !== 'string' || t.name.trim() === '') {
        errors.push(`${modulePath}: tools[${i}] missing or invalid "name" (expected non-empty string).`);
      }
      if (typeof t.description !== 'string' || t.description.trim() === '') {
        errors.push(`${modulePath}: tools[${i}] missing or invalid "description" (expected non-empty string).`);
      }
      if (typeof t.handler !== 'function') {
        errors.push(`${modulePath}: tools[${i}] missing or invalid "handler" (expected function).`);
      }
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter orchestrator test -- src/plugin-loader/_helpers/__tests__/validate-plugin.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add apps/orchestrator/src/plugin-loader/_helpers/validate-plugin.ts apps/orchestrator/src/plugin-loader/_helpers/__tests__/validate-plugin.test.ts
git commit -m "feat(plugin-loader): validate PluginTool arrays during plugin loading"
```

---

### Task 3: Create tool server module

**Files:**
- Create: `apps/orchestrator/src/tool-server/index.ts`
- Create: `apps/orchestrator/src/tool-server/__tests__/index.test.ts`

**Step 1: Write failing tests**

Create `apps/orchestrator/src/tool-server/__tests__/index.test.ts`:

```typescript
import type { PluginContext, PluginDefinition, PluginTool } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  createSdkMcpServer: vi.fn((options: { name: string; tools: unknown[] }) => ({
    name: options.name,
    tools: options.tools,
  })),
  tool: vi.fn((name: string, description: string, _schema: unknown, handler: unknown) => ({
    name,
    description,
    handler,
  })),
}));

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { collectTools, createToolServer } from '../index';

const mockCreateSdkMcpServer = vi.mocked(createSdkMcpServer);
const mockTool = vi.mocked(tool);

const makeHandler = () => vi.fn().mockResolvedValue('result');

const makeTool = (name: string): PluginTool => ({
  name,
  description: `Description for ${name}`,
  schema: { type: 'object', properties: { input: { type: 'string' } } },
  handler: makeHandler(),
});

const makePlugin = (name: string, tools?: PluginTool[]): PluginDefinition => ({
  name,
  version: '1.0.0',
  register: vi.fn().mockResolvedValue({}),
  tools,
});

describe('collectTools', () => {
  it('returns empty array when no plugins have tools', () => {
    const plugins = [makePlugin('a'), makePlugin('b')];
    const result = collectTools(plugins);
    expect(result).toEqual([]);
  });

  it('collects tools from plugins that have them', () => {
    const delegateTool = makeTool('delegate');
    const checkinTool = makeTool('checkin');
    const plugins = [
      makePlugin('delegation', [delegateTool, checkinTool]),
      makePlugin('context'),
    ];
    const result = collectTools(plugins);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      ...delegateTool,
      pluginName: 'delegation',
      qualifiedName: 'delegation__delegate',
    });
    expect(result[1]).toEqual({
      ...checkinTool,
      pluginName: 'delegation',
      qualifiedName: 'delegation__checkin',
    });
  });

  it('collects tools from multiple plugins', () => {
    const plugins = [
      makePlugin('delegation', [makeTool('delegate')]),
      makePlugin('cron', [makeTool('cron_create'), makeTool('cron_delete')]),
    ];
    const result = collectTools(plugins);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.qualifiedName)).toEqual([
      'delegation__delegate',
      'cron__cron_create',
      'cron__cron_delete',
    ]);
  });

  it('skips plugins with empty tools array', () => {
    const plugins = [makePlugin('empty', [])];
    const result = collectTools(plugins);
    expect(result).toEqual([]);
  });
});

describe('createToolServer', () => {
  it('returns null when no tools are collected', () => {
    const result = createToolServer([]);
    expect(result).toBeNull();
    expect(mockCreateSdkMcpServer).not.toHaveBeenCalled();
  });

  it('creates an MCP server with qualified tool names', () => {
    const delegateTool = makeTool('delegate');
    const collected = [
      {
        ...delegateTool,
        pluginName: 'delegation',
        qualifiedName: 'delegation__delegate',
      },
    ];

    createToolServer(collected);

    expect(mockTool).toHaveBeenCalledWith(
      'delegation__delegate',
      delegateTool.description,
      expect.any(Object),
      expect.any(Function),
    );
    expect(mockCreateSdkMcpServer).toHaveBeenCalledWith({
      name: 'harness',
      tools: expect.any(Array),
    });
  });

  it('returns the MCP server instance', () => {
    const collected = [
      { ...makeTool('delegate'), pluginName: 'delegation', qualifiedName: 'delegation__delegate' },
    ];
    const result = createToolServer(collected);
    expect(result).not.toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter orchestrator test -- src/tool-server/__tests__/index.test.ts`
Expected: FAIL — module doesn't exist yet.

**Step 3: Implement tool server**

Create `apps/orchestrator/src/tool-server/index.ts`:

```typescript
// Tool server — collects plugin tools and creates an in-process MCP server
// The MCP server is passed to every Claude query() invocation so the agent
// discovers plugin capabilities as structured tool_use entries

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { PluginDefinition, PluginTool } from '@harness/plugin-contract';

export type CollectedTool = PluginTool & {
  pluginName: string;
  qualifiedName: string;
};

type CollectTools = (plugins: PluginDefinition[]) => CollectedTool[];

export const collectTools: CollectTools = (plugins) => {
  return plugins.flatMap((p) =>
    (p.tools ?? []).map((t) => ({
      ...t,
      pluginName: p.name,
      qualifiedName: `${p.name}__${t.name}`,
    })),
  );
};

type CreateToolServer = (tools: CollectedTool[]) => ReturnType<typeof createSdkMcpServer> | null;

export const createToolServer: CreateToolServer = (tools) => {
  if (tools.length === 0) {
    return null;
  }

  const mcpTools = tools.map((t) =>
    tool(t.qualifiedName, t.description, t.schema, async (input) => {
      // Handler is called by the MCP server when Claude invokes the tool
      // The actual handler binding with ctx and meta happens in the orchestrator boot
      const result = await (t.handler as (input: Record<string, unknown>) => Promise<string>)(
        input as Record<string, unknown>,
      );
      return { content: [{ type: 'text' as const, text: result }] };
    }),
  );

  return createSdkMcpServer({
    name: 'harness',
    tools: mcpTools,
  });
};
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter orchestrator test -- src/tool-server/__tests__/index.test.ts`
Expected: ALL PASS

**Step 5: Run full typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/orchestrator/src/tool-server/index.ts apps/orchestrator/src/tool-server/__tests__/index.test.ts
git commit -m "feat(orchestrator): add tool-server module to collect and expose plugin tools via MCP"
```

---

### Task 4: Wire MCP server into create-session

**Files:**
- Modify: `apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts`
- Modify: `apps/orchestrator/src/invoker-sdk/_helpers/session-pool.ts`
- Test: `apps/orchestrator/src/invoker-sdk/_helpers/__tests__/create-session.test.ts`

**Step 1: Write failing test**

Add to the existing `create-session.test.ts` describe block:

```typescript
it('passes mcpServers to query() when provided', async () => {
  const mockMcpServer = { name: 'harness', tools: [] };
  const session = createSession('test-model', { mcpServers: { harness: mockMcpServer } });

  // Verify query was called with mcpServers in options
  const { query: mockQuery } = await import('@anthropic-ai/claude-agent-sdk');
  expect(vi.mocked(mockQuery)).toHaveBeenCalledWith(
    expect.objectContaining({
      options: expect.objectContaining({
        mcpServers: { harness: mockMcpServer },
      }),
    }),
  );

  session.close();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter orchestrator test -- src/invoker-sdk/_helpers/__tests__/create-session.test.ts`
Expected: FAIL — createSession doesn't accept a second argument yet.

**Step 3: Add mcpServers to create-session**

In `apps/orchestrator/src/invoker-sdk/_helpers/session-pool.ts`, add a `SessionConfig` type:

```typescript
export type SessionConfig = {
  mcpServers?: Record<string, unknown>;
};
```

Update `SessionFactory`:

```typescript
export type SessionFactory = (model: string, config?: SessionConfig) => Session;
```

In `apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts`, update the signature and `query()` call:

```typescript
import type { SessionConfig } from './session-pool';

type CreateSession = (model: string, config?: SessionConfig) => Session;

export const createSession: CreateSession = (model, config) => {
  // ... existing code until the query() call ...

  const q = query({
    prompt: messageStream(),
    options: {
      model,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      env,
      ...(config?.mcpServers ? { mcpServers: config.mcpServers } : {}),
    },
  });

  // ... rest unchanged ...
};
```

**Step 4: Update session-pool.ts get() to pass config through**

In the `get` method of `createSessionPool`, update the factory call to pass config:

```typescript
// In createSessionPool, add config parameter
type CreateSessionPool = (config: SessionPoolConfig, factory: SessionFactory, sessionConfig?: SessionConfig) => SessionPool;

export const createSessionPool: CreateSessionPool = (config, factory, sessionConfig) => {
  // ... existing code ...
  // In get():
  const session = factory(model, sessionConfig);
  // ... rest unchanged ...
};
```

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter orchestrator test -- src/invoker-sdk/_helpers/__tests__/create-session.test.ts`
Expected: ALL PASS

Run: `pnpm --filter orchestrator test -- src/invoker-sdk/_helpers/__tests__/session-pool.test.ts`
Expected: ALL PASS (no behavior change for existing tests)

**Step 6: Commit**

```bash
git add apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts apps/orchestrator/src/invoker-sdk/_helpers/session-pool.ts apps/orchestrator/src/invoker-sdk/_helpers/__tests__/create-session.test.ts
git commit -m "feat(invoker-sdk): pass mcpServers config through to Agent SDK query()"
```

---

### Task 5: Wire MCP server into SDK invoker

**Files:**
- Modify: `apps/orchestrator/src/invoker-sdk/index.ts`
- Test: `apps/orchestrator/src/invoker-sdk/__tests__/index.test.ts`

**Step 1: Write failing test**

Add to the existing `index.test.ts`:

```typescript
it('passes mcpServers to session pool when provided', () => {
  const mockMcpServer = { name: 'harness' };
  const invoker = createSdkInvoker({
    defaultModel: 'test-model',
    defaultTimeout: 5000,
    mcpServers: { harness: mockMcpServer },
  });

  expect(mockCreateSessionPool).toHaveBeenCalledWith(
    expect.any(Object),
    expect.any(Function),
    { mcpServers: { harness: mockMcpServer } },
  );
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter orchestrator test -- src/invoker-sdk/__tests__/index.test.ts`
Expected: FAIL — SdkInvokerConfig doesn't have mcpServers yet.

**Step 3: Add mcpServers to SdkInvokerConfig**

In `apps/orchestrator/src/invoker-sdk/index.ts`:

```typescript
export type SdkInvokerConfig = {
  defaultModel: string;
  defaultTimeout: number;
  mcpServers?: Record<string, unknown>;
};
```

Then pass it through to `createSessionPool`:

```typescript
const pool = createSessionPool(
  {
    maxSessions: 5,
    ttlMs: 8 * 60 * 1000,
  },
  createSession,
  config.mcpServers ? { mcpServers: config.mcpServers } : undefined,
);
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter orchestrator test -- src/invoker-sdk/__tests__/index.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add apps/orchestrator/src/invoker-sdk/index.ts apps/orchestrator/src/invoker-sdk/__tests__/index.test.ts
git commit -m "feat(invoker-sdk): accept mcpServers config and pass to session pool"
```

---

### Task 6: Wire tool collection into orchestrator boot

**Files:**
- Modify: `apps/orchestrator/src/index.ts`
- Test: `apps/orchestrator/src/__tests__/index.test.ts`

**Step 1: Write failing test**

Add to the existing boot test suite in `__tests__/index.test.ts`. First add the mock:

```typescript
vi.mock('../tool-server', () => ({
  collectTools: vi.fn(),
  createToolServer: vi.fn(),
}));
```

Then import and wire up:

```typescript
import { collectTools, createToolServer } from '../tool-server';
const mockCollectTools = vi.mocked(collectTools);
const mockCreateToolServer = vi.mocked(createToolServer);
```

In the `beforeEach`, add defaults:

```typescript
mockCollectTools.mockReturnValue([]);
mockCreateToolServer.mockReturnValue(null);
```

Add the test:

```typescript
it('collects plugin tools and creates tool server during boot', async () => {
  const mockTools = [{ name: 'test', qualifiedName: 'test__tool', pluginName: 'test' }];
  const mockServer = { name: 'harness' };
  mockCollectTools.mockReturnValue(mockTools as never);
  mockCreateToolServer.mockReturnValue(mockServer as never);

  const { shutdown } = await boot();

  expect(mockCollectTools).toHaveBeenCalledWith(expect.any(Array));
  expect(mockCreateToolServer).toHaveBeenCalledWith(mockTools);
  expect(mockCreateSdkInvoker).toHaveBeenCalledWith(
    expect.objectContaining({
      mcpServers: { harness: mockServer },
    }),
  );

  await shutdown();
});

it('creates invoker without mcpServers when no plugin tools exist', async () => {
  mockCollectTools.mockReturnValue([]);
  mockCreateToolServer.mockReturnValue(null);

  const { shutdown } = await boot();

  expect(mockCreateSdkInvoker).toHaveBeenCalledWith(
    expect.not.objectContaining({ mcpServers: expect.anything() }),
  );

  await shutdown();
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter orchestrator test -- src/__tests__/index.test.ts`
Expected: FAIL — boot doesn't call collectTools yet.

**Step 3: Implement tool collection in boot**

In `apps/orchestrator/src/index.ts`, add imports and wire up:

```typescript
import { collectTools, createToolServer } from './tool-server';
```

After `const { loaded } = loader.loadAll();` and before creating the invoker, add:

```typescript
logger.info('Collecting plugin tools');
const allTools = collectTools(loaded);
const toolServer = createToolServer(allTools);

if (toolServer) {
  logger.info('Tool server created', { toolCount: allTools.length });
}
```

Then update the invoker creation to include mcpServers:

```typescript
const invoker = createSdkInvoker({
  defaultModel: config.claudeModel,
  defaultTimeout: config.claudeTimeout,
  ...(toolServer ? { mcpServers: { harness: toolServer } } : {}),
});
```

Note: This means the tool collection and invoker creation order changes slightly — plugins must be loaded before the invoker is created. Move the invoker creation after plugin loading.

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter orchestrator test -- src/__tests__/index.test.ts`
Expected: ALL PASS

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add apps/orchestrator/src/index.ts apps/orchestrator/src/__tests__/index.test.ts
git commit -m "feat(orchestrator): collect plugin tools and create MCP server at boot"
```

---

### Task 7: Add tools to delegation plugin

**Files:**
- Modify: `packages/plugins/delegation/src/index.ts`
- Test: `packages/plugins/delegation/src/__tests__/index.test.ts`

**Step 1: Write failing tests**

Add to the existing delegation plugin test file:

```typescript
describe('plugin tools', () => {
  it('defines delegate and checkin tools', () => {
    expect(plugin.tools).toBeDefined();
    expect(plugin.tools).toHaveLength(2);
  });

  it('delegate tool has correct name and schema', () => {
    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');
    expect(delegateTool).toBeDefined();
    expect(delegateTool!.description).toContain('sub-agent');
    expect(delegateTool!.schema).toEqual(
      expect.objectContaining({
        type: 'object',
        required: ['prompt'],
      }),
    );
    expect(typeof delegateTool!.handler).toBe('function');
  });

  it('checkin tool has correct name and schema', () => {
    const checkinTool = plugin.tools?.find((t) => t.name === 'checkin');
    expect(checkinTool).toBeDefined();
    expect(checkinTool!.description).toContain('progress');
    expect(checkinTool!.schema).toEqual(
      expect.objectContaining({
        type: 'object',
        required: ['message'],
      }),
    );
    expect(typeof checkinTool!.handler).toBe('function');
  });

  it('delegate tool handler calls runDelegationLoop', async () => {
    const ctx = createMockContext();
    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');
    const result = await delegateTool!.handler(
      ctx,
      { prompt: 'Research X' },
      { threadId: 'thread-1' },
    );
    expect(typeof result).toBe('string');
    expect(result).toContain('delegated');
  });

  it('checkin tool handler calls handleCheckin', async () => {
    const ctx = createMockContext();
    const checkinTool = plugin.tools?.find((t) => t.name === 'checkin');
    const result = await checkinTool!.handler(
      ctx,
      { message: 'Making progress' },
      { threadId: 'thread-1' },
    );
    expect(typeof result).toBe('string');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter plugin-delegation test -- src/__tests__/index.test.ts`
Expected: FAIL — plugin.tools is undefined.

**Step 3: Add tools to delegation plugin**

In `packages/plugins/delegation/src/index.ts`, add tools to the plugin definition. The `handler` functions need to work independently from the `onCommand` hooks — they receive `PluginContext` directly.

Add to the `plugin` export and `createDelegationPlugin`:

```typescript
import type { PluginTool } from '@harness/plugin-contract';

const delegateTools: PluginTool[] = [
  {
    name: 'delegate',
    description:
      'Spawn a sub-agent to work on a task in a separate thread. Use this when a task can be done independently and in parallel without blocking the current conversation. The sub-agent works autonomously and results are reported back when complete.',
    schema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed task description for the sub-agent. Be specific — the sub-agent has no context from this conversation.',
        },
        model: {
          type: 'string',
          description: 'Model to use (e.g. claude-sonnet-4-6). Defaults to system default.',
        },
        maxIterations: {
          type: 'number',
          description: 'Maximum validation retry attempts before giving up. Default 5.',
        },
      },
      required: ['prompt'],
    },
    handler: async (ctx, input, meta) => {
      const prompt = input.prompt as string;
      if (!prompt.trim()) {
        return 'Error: prompt is required for delegation.';
      }

      // Fire-and-forget — don't block the conversation
      runDelegationLoop(ctx, pluginState.currentHooks ?? [], {
        prompt,
        parentThreadId: meta.threadId,
        model: input.model as string | undefined,
        maxIterations: input.maxIterations as number | undefined,
      }).catch((err) => {
        ctx.logger.error(`Delegation tool failed: ${err instanceof Error ? err.message : String(err)}`);
      });

      return 'Task delegated successfully. You will receive a notification when the sub-agent completes.';
    },
  },
  {
    name: 'checkin',
    description:
      'Send a progress update to the parent thread. Use this during long-running delegated tasks to keep the user informed of progress.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The progress update message to send to the parent thread.',
        },
      },
      required: ['message'],
    },
    handler: async (ctx, input, meta) => {
      const message = input.message as string;
      await handleCheckin(ctx, meta.threadId, message);
      return 'Check-in sent to parent thread.';
    },
  },
];
```

Update `pluginState` to store hooks reference for tools:

```typescript
export type DelegationPluginState = {
  setHooks: ((hooks: PluginHooks[]) => void) | null;
  currentHooks: PluginHooks[] | null;
};

const pluginState: DelegationPluginState = {
  setHooks: null,
  currentHooks: null,
};
```

In `createRegister`, update `setHooks`:

```typescript
const setHooks: SetHooks = (hooks) => {
  resolvedHooks = hooks;
  pluginState.currentHooks = hooks;
};
```

Add `tools` to both exports:

```typescript
export const plugin: PluginDefinition = {
  name: 'delegation',
  version: '1.0.0',
  register: createRegister(),
  tools: delegateTools,
};

export const createDelegationPlugin: CreateDelegationPlugin = () => ({
  name: 'delegation',
  version: '1.0.0',
  register: createRegister(),
  tools: delegateTools,
});
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter plugin-delegation test -- src/__tests__/index.test.ts`
Expected: ALL PASS

**Step 5: Run full test suite and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add packages/plugins/delegation/src/index.ts packages/plugins/delegation/src/__tests__/index.test.ts
git commit -m "feat(delegation): register delegate and checkin as structured plugin tools"
```

---

### Task 8: End-to-end integration test

**Files:**
- Create: `apps/orchestrator/src/tool-server/__tests__/integration.test.ts`

**Step 1: Write integration test**

This test verifies the full flow: plugin with tools -> collectTools -> createToolServer -> MCP server exists.

```typescript
import type { PluginDefinition } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/claude-agent-sdk', () => {
  const tools: unknown[] = [];
  return {
    tool: vi.fn((name: string, desc: string, schema: unknown, handler: unknown) => {
      const t = { name, description: desc, schema, handler };
      return t;
    }),
    createSdkMcpServer: vi.fn((opts: { name: string; tools: unknown[] }) => {
      tools.push(...opts.tools);
      return { name: opts.name, tools: opts.tools };
    }),
  };
});

import { collectTools, createToolServer } from '../index';

const makePlugin = (name: string, tools?: PluginDefinition['tools']): PluginDefinition => ({
  name,
  version: '1.0.0',
  register: vi.fn().mockResolvedValue({}),
  tools,
});

describe('tool-server integration', () => {
  it('full pipeline: plugins -> collectTools -> createToolServer -> MCP server', () => {
    const plugins = [
      makePlugin('delegation', [
        {
          name: 'delegate',
          description: 'Spawn a sub-agent',
          schema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
          handler: vi.fn().mockResolvedValue('delegated'),
        },
        {
          name: 'checkin',
          description: 'Send progress update',
          schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
          handler: vi.fn().mockResolvedValue('checked in'),
        },
      ]),
      makePlugin('context'),
      makePlugin('web'),
    ];

    const collected = collectTools(plugins);
    expect(collected).toHaveLength(2);
    expect(collected[0]!.qualifiedName).toBe('delegation__delegate');
    expect(collected[1]!.qualifiedName).toBe('delegation__checkin');

    const server = createToolServer(collected);
    expect(server).not.toBeNull();
    expect((server as { name: string }).name).toBe('harness');
  });

  it('returns null server when no plugins have tools', () => {
    const plugins = [makePlugin('context'), makePlugin('web')];
    const collected = collectTools(plugins);
    const server = createToolServer(collected);
    expect(server).toBeNull();
  });
});
```

**Step 2: Run integration test**

Run: `pnpm --filter orchestrator test -- src/tool-server/__tests__/integration.test.ts`
Expected: ALL PASS

**Step 3: Run full test suite, typecheck, lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add apps/orchestrator/src/tool-server/__tests__/integration.test.ts
git commit -m "test(tool-server): add integration test for full plugin tools pipeline"
```

---

### Task 9: Final validation and cleanup

**Step 1: Run the full CI pipeline**

Run: `pnpm ci`
Expected: ALL PASS (sherif -> typecheck -> lint -> build)

**Step 2: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

**Step 3: Boot the orchestrator and verify tool logging**

Run: `timeout 10 pnpm --filter orchestrator dev 2>&1`
Expected output should include:
- `Collecting plugin tools`
- `Tool server created { toolCount: 2 }`
- `Orchestrator ready`

**Step 4: Commit any remaining changes**

If any lint/biome fixes were applied automatically, commit them:

```bash
git add -A
git commit -m "chore: lint and format fixes for plugin tool registration"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Add PluginTool types | plugin-contract/src/index.ts |
| 2 | Validate tools in plugin loader | plugin-loader validate-plugin.ts + tests |
| 3 | Create tool-server module | tool-server/index.ts + tests |
| 4 | Wire MCP into create-session | create-session.ts, session-pool.ts + tests |
| 5 | Wire MCP into SDK invoker | invoker-sdk/index.ts + tests |
| 6 | Wire tool collection into boot | orchestrator index.ts + tests |
| 7 | Add tools to delegation plugin | delegation/index.ts + tests |
| 8 | Integration test | tool-server integration.test.ts |
| 9 | Final validation | CI pipeline, boot verification |

After this is complete, Claude subprocesses will see `delegation__delegate` and `delegation__checkin` as structured tools and can invoke them naturally from conversation.
