# Plugin Tool Registration

## Problem

Claude subprocesses spawned by the orchestrator have no way to discover what actions are available. The only mechanism is text-parsed slash commands (`/delegate`, `/checkin`) which require exact syntax, CLAUDE.md documentation, and regex parsing. This means:

- Users can't say "spin up a sub-agent to research X" in natural language
- Claude can't discover capabilities from conversation context
- Command parsing is fragile (regex, format drift across model versions)
- No input validation on command arguments
- No way for plugins to advertise new capabilities without editing CLAUDE.md

## Solution

Plugins register structured tool schemas alongside their hooks. The orchestrator collects all plugin tools at boot, creates an in-process MCP server, and passes it to every Claude subprocess invocation. Claude sees the tools as native `tool_use` entries and invokes them via structured API calls.

## Design

### Plugin Contract Changes

Add `PluginTool` type and optional `tools` array to `PluginDefinition`:

```typescript
// In packages/plugin-contract/src/index.ts

type PluginToolHandler = (
  ctx: PluginContext,
  input: Record<string, unknown>,
  meta: { threadId: string; taskId?: string }
) => Promise<string>;

type PluginTool = {
  name: string;
  description: string;
  schema: Record<string, unknown>;  // JSON Schema object
  handler: PluginToolHandler;
};

type PluginDefinition = {
  name: string;
  version: string;
  register: RegisterFn;
  start?: StartFn;
  stop?: StopFn;
  tools?: PluginTool[];  // NEW
};
```

Notes:
- `schema` is a plain JSON Schema object, not Zod. Zod is a build-time convenience plugins can use to generate the schema, but the contract itself is framework-agnostic.
- `handler` receives the validated input, the PluginContext, and metadata (threadId, optional taskId). Returns a string result that goes back to Claude as `tool_result`.
- `tools` is static on the definition, not dynamic per-registration. Tools don't change at runtime.

### Plugin Implementation Example

```typescript
// packages/plugins/delegation/src/index.ts

export const plugin: PluginDefinition = {
  name: 'delegation',
  version: '1.0.0',
  register: createRegister(),
  tools: [
    {
      name: 'delegate',
      description: 'Spawn a sub-agent to work on a task in a separate thread. Use this when a task can be done independently without blocking the current conversation. The sub-agent will work autonomously and report results back.',
      schema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed task description for the sub-agent',
          },
          model: {
            type: 'string',
            description: 'Model to use (e.g. claude-sonnet-4-6). Defaults to system default.',
          },
          maxIterations: {
            type: 'number',
            description: 'Maximum validation retry attempts. Default 5.',
          },
        },
        required: ['prompt'],
      },
      handler: async (ctx, input, meta) => {
        // Fire-and-forget delegation
        runDelegationLoop(ctx, allHooks, {
          prompt: input.prompt as string,
          parentThreadId: meta.threadId,
          model: input.model as string | undefined,
          maxIterations: input.maxIterations as number | undefined,
        }).catch((err) => {
          ctx.logger.error(`Delegation failed: ${err}`);
        });
        return 'Task delegated. You will be notified when it completes.';
      },
    },
    {
      name: 'checkin',
      description: 'Send a progress update to the parent thread. Use this during long-running delegated tasks to keep the user informed.',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The progress update message',
          },
        },
        required: ['message'],
      },
      handler: async (ctx, input, meta) => {
        await handleCheckin(ctx, meta.threadId, input.message as string);
        return 'Check-in sent.';
      },
    },
  ],
};
```

### Orchestrator Changes

#### Tool Collection (at boot)

After all plugins are loaded and validated, the orchestrator collects tools:

```typescript
// In apps/orchestrator/src/index.ts boot sequence

const allTools = loadedPlugins.flatMap((p) =>
  (p.tools ?? []).map((tool) => ({
    ...tool,
    pluginName: p.name,
    qualifiedName: `${p.name}__${tool.name}`,
  }))
);
```

#### MCP Server Creation

Create an in-process MCP server from collected tools:

```typescript
// New file: apps/orchestrator/src/tool-server/index.ts

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

const createToolServer = (allTools, ctx) => {
  return createSdkMcpServer({
    name: 'harness',
    tools: allTools.map((t) =>
      tool(t.qualifiedName, t.description, t.schema, async (input) => {
        return t.handler(ctx, input, { threadId: currentThreadId });
      })
    ),
  });
};
```

#### Pass MCP Server to Invocations

The SDK invoker passes the MCP server when creating sessions:

```typescript
// In apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts

const conversation = session.query(prompt, {
  mcpServers: { harness: toolServer },
  // ... existing options
});
```

### What Gets Deprecated

Once all commands are ported to tools:

1. `PluginHooks.onCommand` — replaced by `PluginDefinition.tools`
2. `parseCommands()` in orchestrator pipeline — no longer needed
3. `parseCommands()` in delegation plugin — no longer needed
4. `response-parser.ts` `[COMMAND]` block parsing — already unused, can be removed
5. `command-router.ts` — built but unused, can be removed
6. CLAUDE.md sections documenting slash command syntax — Claude discovers tools from schemas

### Migration Path

The migration is additive:

1. Add `tools` to plugin contract (optional field — no breaking change)
2. Build tool server in orchestrator
3. Wire MCP server into SDK invoker
4. Port delegation plugin commands to tools
5. Verify tools work end-to-end
6. Remove onCommand, parseCommands, response-parser, command-router
7. Remove slash command documentation from agent CLAUDE.md

Steps 1-5 can ship together. Steps 6-7 are cleanup after validation.

### What This Does NOT Change

- All passive hooks (onMessage, onBeforeInvoke, onAfterInvoke, onTaskCreate, onTaskComplete, onTaskFailed, onBroadcast) stay exactly as they are
- Plugin lifecycle (register, start, stop) stays the same
- PluginContext API stays the same
- Plugin enable/disable via PluginConfig database stays the same
- Zero cross-plugin coupling stays the same

## Validation Plugin (Phase 2)

After tool registration works, a validation plugin registers an `onTaskComplete` hook that reviews sub-agent output:

```typescript
// packages/plugins/validation/src/index.ts

export const plugin: PluginDefinition = {
  name: 'validation',
  version: '1.0.0',
  register: async (ctx) => ({
    onTaskComplete: async (threadId, taskId, result) => {
      // Invoke Claude to review the sub-agent's output
      const review = await ctx.invoker.invoke(
        `Review this sub-agent output for completeness and quality:\n\n${result}`,
        { model: 'haiku' }
      );
      // Parse accept/reject from review
      // Return { accepted: true } or { accepted: false, feedback: '...' }
    },
  }),
};
```

This gives the review loop: delegate -> sub-agent works -> validator reviews -> accept or re-delegate with feedback.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/plugin-contract/src/index.ts` | Modify | Add PluginTool, PluginToolHandler types; add tools to PluginDefinition |
| `apps/orchestrator/src/tool-server/index.ts` | Create | Collect plugin tools, create MCP server |
| `apps/orchestrator/src/tool-server/__tests__/index.test.ts` | Create | Tests for tool collection and MCP server creation |
| `apps/orchestrator/src/invoker-sdk/_helpers/create-session.ts` | Modify | Pass MCP server to query() |
| `apps/orchestrator/src/invoker-sdk/__tests__/index.test.ts` | Modify | Test MCP server is passed through |
| `apps/orchestrator/src/index.ts` | Modify | Collect tools at boot, create tool server, pass to invoker |
| `apps/orchestrator/src/__tests__/index.test.ts` | Modify | Test boot sequence with tools |
| `packages/plugins/delegation/src/index.ts` | Modify | Add tools array with delegate and checkin |
| `packages/plugins/delegation/src/__tests__/index.test.ts` | Modify | Test tool definitions |
| `apps/orchestrator/src/plugin-loader/_helpers/validate-plugin.ts` | Modify | Validate tools array if present |
| `apps/orchestrator/src/plugin-loader/_helpers/__tests__/validate-plugin.test.ts` | Modify | Test tool validation |
