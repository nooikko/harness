# Plugin Development Guide

This guide covers everything you need to build a plugin for the Harness orchestrator. It documents the plugin contract, lifecycle hooks, directory structure conventions, registration process, and testing patterns.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [PluginDefinition Interface](#plugindefinition-interface)
3. [PluginContext API](#plugincontext-api)
4. [PluginHooks API](#pluginhooks-api)
5. [Hook Runner Utilities](#hook-runner-utilities)
6. [Creating a New Plugin Step-by-Step](#creating-a-new-plugin-step-by-step)
7. [Registering Plugins](#registering-plugins)
8. [Testing Plugins](#testing-plugins)
9. [Existing Plugin Examples](#existing-plugin-examples)

---

## Architecture Overview

The Harness orchestrator follows a **plugin-first** architecture. The core is a minimal message pipeline with lifecycle hooks. Everything beyond the pipeline (Discord integration, web API, cron scheduling, sub-agent delegation, context injection) is a plugin.

### How Plugins Fit Into the Pipeline

The core message pipeline runs in this order:

```
receive message
  -> persist to database
  -> fire onBeforeInvoke hooks (prompt assembly)
  -> invoke Claude CLI (claude -p)
  -> fire onAfterInvoke hooks (post-processing)
  -> parse response for [COMMAND] blocks
  -> fire onCommand hooks (command dispatch)
  -> respond to source
  -> fire onBroadcast hooks (event notification)
```

Plugins attach to any of these hook points during registration. A plugin can be a message source (Discord, web), a prompt enricher (context), a command handler (delegation), an event listener (web/WebSocket broadcasting), or any combination.

### Dependency Flow

```
apps/orchestrator
  -> imports @harness/plugin-contract (types + hook runners)
  -> imports plugin packages (@harness/plugin-context, @harness/plugin-discord, etc.)

packages/plugins/*
  -> imports @harness/plugin-contract (types)
  -> imports database (Prisma client + types)
  -> NEVER imports from the orchestrator
```

Plugins depend on `@harness/plugin-contract` and `database`. They never import from the orchestrator or from other plugins. The orchestrator imports plugins via a static registry.

---

## PluginDefinition Interface

Every plugin must export a `PluginDefinition` object. The contract is defined in `packages/plugin-contract/src/index.ts`:

```typescript
type PluginDefinition = {
  name: string;
  version: string;
  register: RegisterFn;
  start?: StartFn;
  stop?: StopFn;
};
```

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Unique plugin identifier (e.g., `"context"`, `"discord"`, `"web"`) |
| `version` | `string` | Yes | Semantic version string (e.g., `"1.0.0"`) |
| `register` | `RegisterFn` | Yes | Called at boot to set up hooks. Returns a `PluginHooks` object. |
| `start` | `StartFn` | No | Called after all plugins register. Used to start servers, connect clients, load data. |
| `stop` | `StopFn` | No | Called on SIGTERM/SIGINT for graceful shutdown. |

### Function Signatures

```typescript
type RegisterFn = (ctx: PluginContext) => Promise<PluginHooks>;
type StartFn = (ctx: PluginContext) => Promise<void>;
type StopFn = (ctx: PluginContext) => Promise<void>;
```

### Plugin Lifecycle

1. **Import** -- The plugin registry statically imports all plugin packages and returns them as an array. No filesystem scanning.
2. **Sync** -- The registry synchronizes the plugin list with `PluginConfig` records in the database. New plugins get a config row; stale configs are removed.
3. **Filter** -- Plugins disabled in the database (`PluginConfig.enabled = false`) are filtered out.
4. **Registration** -- Each enabled plugin's `register(ctx)` is called. Plugins receive the `PluginContext` and return their `PluginHooks`.
5. **Start** -- After all plugins register, the orchestrator calls `start(ctx)` on each plugin that exports it. This is where Discord connects, Express listens, cron jobs load, etc.
6. **Runtime** -- The message pipeline runs. Hooks fire in registration order.
7. **Shutdown** -- On SIGTERM/SIGINT, the orchestrator calls `stop(ctx)` on each plugin for graceful cleanup.

---

## PluginContext API

The `PluginContext` is the API surface the orchestrator gives to every plugin during registration. It provides database access, the Claude CLI invoker, configuration, logging, and messaging utilities.

```typescript
type PluginContext = {
  db: PrismaClient;
  invoker: Invoker;
  config: OrchestratorConfig;
  logger: Logger;
  sendToThread: (threadId: string, content: string) => Promise<void>;
  broadcast: (event: string, data: unknown) => Promise<void>;
};
```

### `db: PrismaClient`

The shared Prisma client instance. Plugins can query and write to any table in the database. Use Prisma-generated types directly:

```typescript
import type { Thread, Message } from "database";

const thread = await ctx.db.thread.findUnique({ where: { id: threadId } });
const messages = await ctx.db.message.findMany({
  where: { threadId },
  orderBy: { createdAt: "desc" },
  take: 50,
});
```

### `invoker: Invoker`

Access to the Claude CLI subprocess wrapper. Primarily used by the delegation plugin to spawn sub-agents.

```typescript
type Invoker = {
  invoke: (prompt: string, options?: InvokeOptions) => Promise<InvokeResult>;
};

type InvokeOptions = {
  model?: string;
  timeout?: number;
  allowedTools?: string[];
  maxTokens?: number;
};

type InvokeResult = {
  output: string;
  error?: string;
  durationMs: number;
  exitCode: number | null;
};
```

Usage:

```typescript
const result = await ctx.invoker.invoke("Summarize this document", {
  model: "claude-sonnet-4-6",
  timeout: 60000,
});

if (result.exitCode === 0) {
  ctx.logger.info(`Agent responded in ${result.durationMs}ms`);
}
```

### `config: OrchestratorConfig`

The resolved configuration object. Read-only. Contains all environment-driven settings:

```typescript
type OrchestratorConfig = {
  databaseUrl: string;
  timezone: string;
  maxConcurrentAgents: number;
  claudeModel: string;
  claudeTimeout: number;
  discordToken: string | undefined;
  discordChannelId: string | undefined;
  port: number;
  logLevel: LogLevel;
};
```

### `logger: Logger`

A scoped logger instance. Plugins should use this instead of `console.log`:

```typescript
ctx.logger.info("Plugin started");
ctx.logger.warn("Missing configuration");
ctx.logger.error("Failed to process message");
ctx.logger.debug("Processing details", { threadId, messageCount: 5 });
```

### `sendToThread(threadId, content)`

Writes a message directly to any thread. The message is persisted to the database and broadcast to connected clients. Used for cross-thread notifications (e.g., the delegation plugin notifying a parent thread when a task completes).

```typescript
await ctx.sendToThread(parentThreadId, "Task completed: research report ready.");
```

### `broadcast(event, data)`

Emits an event to all registered broadcast listeners (plugins that implement the `onBroadcast` hook). Used to push real-time updates to the web dashboard via WebSocket.

```typescript
await ctx.broadcast("task:created", {
  taskId,
  threadId,
  parentThreadId,
});
```

---

## PluginHooks API

The `register` function returns a `PluginHooks` object. Each hook is optional -- implement only the hooks your plugin needs.

```typescript
type PluginHooks = {
  onMessage?: (threadId: string, role: string, content: string) => Promise<void>;
  onBeforeInvoke?: (threadId: string, prompt: string) => Promise<string>;
  onAfterInvoke?: (threadId: string, result: InvokeResult) => Promise<void>;
  onCommand?: (threadId: string, command: string, args: string) => Promise<boolean>;
  onTaskCreate?: (threadId: string, taskId: string) => Promise<void>;
  onTaskComplete?: (threadId: string, taskId: string, result: string) => Promise<void>;
  onTaskFailed?: (threadId: string, taskId: string, error: Error) => Promise<void>;
  onBroadcast?: (event: string, data: unknown) => Promise<void>;
};
```

### Hook Descriptions

#### `onMessage`

Fires when a new message enters the pipeline. Used by plugins that need to observe or react to incoming messages.

```typescript
onMessage: async (threadId, role, content) => {
  ctx.logger.info(`Message in thread ${threadId}: [${role}] ${content.slice(0, 50)}`);
};
```

#### `onBeforeInvoke`

**Chain hook.** Called before the Claude CLI is invoked. Receives the current prompt and returns a modified prompt. Multiple plugins can chain their modifications -- each receives the output of the previous hook. The context plugin uses this to inject memory, world-state, and conversation history.

```typescript
onBeforeInvoke: async (threadId, prompt) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date().toISOString();
  return `Current time: ${now} (${timezone})\n\n${prompt}`;
};
```

#### `onAfterInvoke`

**Notification hook.** Called after the Claude CLI responds, before response parsing. Used for logging, metrics, or response post-processing.

```typescript
onAfterInvoke: async (threadId, result) => {
  await ctx.db.metric.create({
    data: {
      name: "invocation",
      value: result.durationMs,
      metadata: { threadId, exitCode: result.exitCode },
    },
  });
};
```

#### `onCommand`

**Result hook with early termination.** Called when a `[COMMAND]` block is parsed from the agent's response. Returns `true` if the command was handled, `false` to pass to the next plugin. Only the first plugin that returns `true` handles the command.

```typescript
onCommand: async (threadId, command, args) => {
  if (command === "delegate") {
    await handleDelegation(ctx, threadId, args);
    return true;
  }
  return false;
};
```

#### `onTaskCreate`

**Notification hook.** Fires when a delegation task is created, before the sub-agent is invoked. Used by plugins that need to set up task infrastructure (e.g., a worktree plugin creating an isolated git worktree).

```typescript
onTaskCreate: async (threadId, taskId) => {
  ctx.logger.info(`Task created: ${taskId} in thread ${threadId}`);
};
```

#### `onTaskComplete`

**Notification hook.** Fires when a sub-agent reports work as done. Used by validation plugins to inspect results.

```typescript
onTaskComplete: async (threadId, taskId, result) => {
  ctx.logger.info(`Task ${taskId} completed with ${result.length} chars of output`);
};
```

#### `onTaskFailed`

**Notification hook.** Fires when a task fails after exhausting max iterations or encountering an unrecoverable error. Used for cleanup.

```typescript
onTaskFailed: async (threadId, taskId, error) => {
  ctx.logger.error(`Task ${taskId} failed: ${error.message}`);
};
```

#### `onBroadcast`

**Notification hook.** Receives pipeline events emitted via `ctx.broadcast()`. The web plugin uses this to push events over WebSocket to the dashboard.

```typescript
onBroadcast: async (event, data) => {
  broadcaster.broadcast(event, data);
};
```

---

## Hook Runner Utilities

The `@harness/plugin-contract` package exports three hook runner utilities that the orchestrator uses to iterate over plugin hooks. Understanding these helps explain how hooks are executed.

### `runHook` -- Notification-style (fire-and-await)

Calls the hook on every plugin sequentially. Errors are caught and logged but do not stop execution. Used for `onMessage`, `onAfterInvoke`, `onTaskCreate`, `onTaskComplete`, `onTaskFailed`, and `onBroadcast`.

```typescript
import { runHook } from "@harness/plugin-contract";

await runHook(
  allHooks,
  "onTaskCreate",
  (hooks) => hooks.onTaskCreate?.(threadId, taskId),
  logger,
);
```

### `runHookWithResult` -- Command-style (boolean return, early termination)

Calls the hook on each plugin until one returns `true`. Used for `onCommand` -- the first plugin that handles a command stops the chain.

```typescript
import { runHookWithResult } from "@harness/plugin-contract";

const handled = await runHookWithResult(
  allHooks,
  "onCommand",
  (hooks) => hooks.onCommand?.(threadId, command, args),
  logger,
);
```

### `runChainHook` -- Sequential value transformation

Passes a value through each plugin's hook sequentially, where each hook can transform the value. Used for `onBeforeInvoke` -- each plugin enriches the prompt.

```typescript
import { runChainHook } from "@harness/plugin-contract";

const enrichedPrompt = await runChainHook(
  allHooks,
  "onBeforeInvoke",
  originalPrompt,
  (hooks, currentPrompt) => hooks.onBeforeInvoke?.(threadId, currentPrompt),
  logger,
);
```

All three runners isolate errors per plugin -- if one plugin's hook throws, the others still run.

---

## Creating a New Plugin Step-by-Step

This section walks through creating a plugin from scratch, following the project's conventions.

### 1. Create the Package Directory

Plugins live under `packages/plugins/`. Create a new directory:

```
packages/plugins/my-plugin/
```

### 2. Create `package.json`

```json
{
  "name": "@harness/plugin-my-plugin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
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
    "typescript": "^5.9.3",
    "vitest": "^4.0.18"
  }
}
```

Key points:
- The package name follows the `@harness/plugin-<name>` convention.
- `@harness/plugin-contract` and `database` are workspace dependencies.
- Add any plugin-specific dependencies here (e.g., `discord.js` for Discord, `express` for HTTP). Interface-specific deps belong in the plugin, not the orchestrator.

### 3. Create `tsconfig.json`

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

### 4. Create `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "plugin-my-plugin",
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
```

### 5. Create the Directory Structure

Follow the project's co-location, isolation, and orchestration tenets:

```
packages/plugins/my-plugin/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                    -> Plugin definition (orchestration)
    __tests__/
      index.test.ts             -> Tests for index.ts
    _helpers/
      some-helper.ts            -> One isolated concern per file
      another-helper.ts
      __tests__/
        some-helper.test.ts
        another-helper.test.ts
```

Rules:
- `index.ts` is orchestration -- it wires helpers together, returns the `PluginDefinition`.
- Each file in `_helpers/` exports exactly one function, named to match the kebab-case filename.
- Tests live in `__tests__/` directories within the directory they test.
- All file names are kebab-case. A Claude Code hook blocks non-kebab-case names.

### 6. Write the Plugin Entry Point

Here is a minimal plugin template:

```typescript
// packages/plugins/my-plugin/src/index.ts

import type {
  PluginContext,
  PluginDefinition,
  PluginHooks,
} from "@harness/plugin-contract";

type CreateRegister = () => PluginDefinition["register"];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info("My plugin registered");

    return {
      onBeforeInvoke: async (threadId, prompt) => {
        // Enrich the prompt before Claude is invoked
        const extra = "Additional context from my plugin.";
        return `${extra}\n\n${prompt}`;
      },
    };
  };

  return register;
};

export const plugin: PluginDefinition = {
  name: "my-plugin",
  version: "1.0.0",
  register: createRegister(),
};
```

### 7. Add `start` and `stop` (Optional)

If your plugin needs to start a server, connect to an external service, or load persistent state:

```typescript
export const plugin: PluginDefinition = {
  name: "my-plugin",
  version: "1.0.0",
  register: createRegister(),

  start: async (ctx) => {
    ctx.logger.info("My plugin starting...");
    // Connect to external service, start server, load data, etc.
  },

  stop: async (ctx) => {
    ctx.logger.info("My plugin stopping...");
    // Graceful cleanup: disconnect, close servers, flush data
  },
};
```

### 8. Extract Helpers

When your plugin logic grows, extract isolated concerns into `_helpers/`:

```typescript
// packages/plugins/my-plugin/src/_helpers/format-extra-context.ts

type FormatExtraContext = (data: string[]) => string;

export const formatExtraContext: FormatExtraContext = (data) => {
  if (data.length === 0) {
    return "";
  }
  return `# Extra Context\n\n${data.join("\n")}`;
};
```

Then import it in `index.ts`:

```typescript
import { formatExtraContext } from "./_helpers/format-extra-context";
```

Each helper gets one export, one purpose, and its own test file.

### 9. Install Dependencies

After creating the package, run from the monorepo root:

```bash
pnpm install
```

This links the workspace dependency graph.

---

## Registering Plugins

Plugins are registered via the **static plugin registry** at `apps/orchestrator/src/plugin-registry/index.ts`. There is no filesystem scanning -- every plugin is an explicit import.

### Adding a Plugin to the Registry

1. Add your plugin package as a dependency to `apps/orchestrator/package.json`:

```json
{
  "dependencies": {
    "@harness/plugin-my-plugin": "workspace:*"
  }
}
```

2. Import and add your plugin to the `ALL_PLUGINS` array in `apps/orchestrator/src/plugin-registry/index.ts`:

```typescript
import { plugin as myPlugin } from "@harness/plugin-my-plugin";

const ALL_PLUGINS: PluginDefinition[] = [
  contextPlugin,
  discordPlugin,
  webPlugin,
  delegationPlugin,
  myPlugin,           // Add your plugin here
];
```

3. Run `pnpm install` from the monorepo root to link the new workspace dependency.

### How the Registry Works

The registry does two things at boot:

1. **Syncs with the database.** It calls `syncPluginConfigs()` which creates `PluginConfig` rows for new plugins and removes rows for plugins no longer in the registry. This is how the dashboard knows which plugins exist.

2. **Filters disabled plugins.** It calls `filterDisabledPlugins()` which checks each plugin's `PluginConfig.enabled` flag. Disabled plugins are excluded from the returned array.

This means plugins can be toggled on/off at runtime via the database without changing code.

### Plugin Config in the Database

Each plugin gets a row in the `PluginConfig` table:

| Column | Type | Description |
|---|---|---|
| `id` | cuid | Primary key |
| `pluginName` | string (unique) | Matches `plugin.name` |
| `enabled` | boolean | Whether the plugin is active (default: `true`) |
| `config` | JSON | Plugin-specific configuration (optional) |

When a new plugin is added to the registry, `syncPluginConfigs()` automatically creates its database row with `enabled: true`. When a plugin is removed from the registry, its row is deleted.

---

## Testing Plugins

### Mocking PluginContext

The standard pattern for testing plugins is to create a mock `PluginContext`. Here is the pattern used across the codebase:

```typescript
import type { PluginContext } from "@harness/plugin-contract";
import { describe, expect, it, vi } from "vitest";

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () => ({
  db: {
    message: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    thread: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: "thread-1" }),
    },
  } as never,
  invoker: {
    invoke: vi.fn().mockResolvedValue({
      output: "Agent response",
      durationMs: 1000,
      exitCode: 0,
    }),
  },
  config: {
    databaseUrl: "postgresql://test",
    timezone: "America/Phoenix",
    maxConcurrentAgents: 2,
    claudeModel: "claude-sonnet-4-6",
    claudeTimeout: 30000,
    discordToken: undefined,
    discordChannelId: undefined,
    port: 3001,
    logLevel: "info",
  } as never,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  sendToThread: vi.fn(),
  broadcast: vi.fn(),
});
```

Cast `db` to `as never` because you only need to mock the specific Prisma methods your plugin calls -- you don't need the full `PrismaClient` interface.

### Testing Hooks

Test that your plugin returns the expected hooks and that they behave correctly:

```typescript
describe("my plugin", () => {
  it("has correct name and version", () => {
    expect(plugin.name).toBe("my-plugin");
    expect(plugin.version).toBe("1.0.0");
  });

  it("registers and returns onBeforeInvoke hook", async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks.onBeforeInvoke).toBeDefined();
    expect(typeof hooks.onBeforeInvoke).toBe("function");
  });

  it("enriches the prompt via onBeforeInvoke", async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.("thread-1", "User message");

    expect(result).toContain("Additional context");
    expect(result).toContain("User message");
  });
});
```

### Testing Helpers in Isolation

Each helper in `_helpers/` gets its own test file. Helpers are pure functions or functions with explicit dependencies that are easy to mock:

```typescript
// packages/plugins/my-plugin/src/_helpers/__tests__/format-extra-context.test.ts

import { describe, expect, it } from "vitest";
import { formatExtraContext } from "../format-extra-context";

describe("formatExtraContext", () => {
  it("returns empty string for empty data", () => {
    expect(formatExtraContext([])).toBe("");
  });

  it("formats data with header", () => {
    const result = formatExtraContext(["item 1", "item 2"]);
    expect(result).toContain("# Extra Context");
    expect(result).toContain("item 1");
    expect(result).toContain("item 2");
  });
});
```

### Running Tests

```bash
# Run tests for your plugin only
pnpm --filter @harness/plugin-my-plugin test

# Run tests in watch mode
pnpm --filter @harness/plugin-my-plugin test:watch

# Run all tests across the monorepo
pnpm test

# Run the coverage gate (enforces 80% line + branch coverage)
pnpm test:coverage-gate
```

### Coverage Requirements

The pre-commit hook enforces:
- **80% line and branch coverage** on staged `.ts/.tsx` files
- **No barrel files** -- files that only contain `export * from` re-exports are rejected

Excluded from coverage: `*.config.ts`, `*.setup.ts`, `*.d.ts`, `*.test.ts`, `*.spec.ts`, generated files.

---

## Existing Plugin Examples

The codebase includes several plugins at varying levels of complexity. Study these as reference implementations.

### Context Plugin (`packages/plugins/context/`)

**Package:** `@harness/plugin-context`
**Complexity:** Simple
**Hooks used:** `onBeforeInvoke`

The context plugin reads markdown files from the `context/` directory and conversation history from the database, then injects them into the prompt before Claude is invoked. It is the simplest real plugin and the best starting point for understanding the pattern.

Key patterns demonstrated:
- Factory function (`createContextPlugin`) for configurable instantiation
- `onBeforeInvoke` chain hook that enriches the prompt
- Helpers split by purpose: `file-reader.ts`, `file-cache.ts`, `file-discovery.ts`, `format-context-section.ts`, `format-history-section.ts`, `history-loader.ts`, `match-pattern.ts`
- Each helper has its own test file under `_helpers/__tests__/`
- Uses direct `fs` calls for performance (not MCP tools)

**Source:** `packages/plugins/context/src/index.ts`

### Discord Plugin (`packages/plugins/discord/`)

**Package:** `@harness/plugin-discord`
**Complexity:** Medium
**Hooks used:** (none via `PluginHooks`, uses `start`/`stop` lifecycle)

The Discord plugin connects a Discord bot as a message source and reply sink. It demonstrates the `start`/`stop` lifecycle for managing external connections, internal state tracking, and message routing.

Key patterns demonstrated:
- `start()` connects the Discord.js client, registers message listeners
- `stop()` gracefully disconnects the client
- Internal state object (`DiscordPluginState`) tracks connection status
- Helpers: `message-adapter.ts`, `channel-resolver.ts`, `should-process-message.ts`, `strip-mentions.ts`, `extract-channel-id.ts`, `build-source-id.ts`
- Uses `ctx.db` for thread/message persistence
- Uses `ctx.broadcast()` to notify the pipeline of incoming messages

**Source:** `packages/plugins/discord/src/index.ts`

### Web Plugin (`packages/plugins/web/`)

**Package:** `@harness/plugin-web`
**Complexity:** Medium
**Hooks used:** `onBroadcast`

The web plugin runs an Express HTTP server and WebSocket server for the dashboard. It demonstrates using `onBroadcast` to push real-time events to connected clients.

Key patterns demonstrated:
- Creates HTTP server and WebSocket broadcaster during `register()`
- Starts listening during `start()`
- `onBroadcast` hook forwards pipeline events over WebSocket
- Helpers: `routes.ts` (Express route definitions), `ws-broadcaster.ts` (WebSocket management)
- Uses `ctx.sendToThread()` and `ctx.broadcast()` for messaging

**Source:** `packages/plugins/web/src/index.ts`

### Delegation Plugin (`packages/plugins/delegation/`)

**Package:** `@harness/plugin-delegation`
**Complexity:** High
**Hooks used:** `onCommand`

The delegation plugin handles `delegate` and `re-delegate` commands, spawning sub-agents with iteration control and validation. It is the most complex plugin and demonstrates advanced patterns.

Key patterns demonstrated:
- `onCommand` hook with boolean return for command dispatch
- Sub-agent invocation via `ctx.invoker.invoke()`
- Task lifecycle management (create thread, create task, iterate, validate, finalize)
- Cross-thread notifications via `ctx.sendToThread()`
- Event broadcasting via `ctx.broadcast()` for real-time dashboard updates
- Fires hooks on other plugins via `runHook()` (onTaskCreate, onTaskFailed)
- Fires validation hooks via a custom `fireTaskCompleteHooks` helper
- Extensive helper decomposition: `delegation-loop.ts`, `build-iteration-prompt.ts`, `create-task-record.ts`, `create-task-thread.ts`, `fire-task-complete-hooks.ts`, `invoke-sub-agent.ts`, `record-agent-run.ts`, `send-thread-notification.ts`
- Late-binding hook references (`setHooks` pattern) for cross-plugin hook invocation

**Source:** `packages/plugins/delegation/src/index.ts`

---

## Code Style Reminders

When writing plugins, follow these project conventions:

- **Arrow functions only.** No `function` keyword. Define the function type separately, then annotate the const.
- **Types are co-located.** Plugin-specific types live in the plugin's own files. Never create centralized `types.ts` files. Use Prisma-generated types directly via `import type { Thread } from "database"`.
- **kebab-case file names.** Enforced by a Claude Code hook.
- **One export per helper file.** `_helpers/format-prompt.ts` exports `formatPrompt`. If you need a second export, create a second file.
- **Import from module directories.** Never reach into `_helpers/` from outside the module.
- **No `.ts` or `.js` extensions in import paths.**
- **Biome for formatting and linting.** Run `pnpm check` to lint and format in one pass.

---

## Quick Reference

### Minimal Plugin Template

```typescript
import type { PluginContext, PluginDefinition, PluginHooks } from "@harness/plugin-contract";

type CreateRegister = () => PluginDefinition["register"];

const createRegister: CreateRegister = () => async (ctx: PluginContext): Promise<PluginHooks> => {
  ctx.logger.info("My plugin registered");
  return {};
};

export const plugin: PluginDefinition = {
  name: "my-plugin",
  version: "1.0.0",
  register: createRegister(),
};
```

### Package Dependencies

```json
{
  "dependencies": {
    "@harness/plugin-contract": "workspace:*",
    "database": "workspace:*"
  }
}
```

### File Structure

```
packages/plugins/my-plugin/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    __tests__/
      index.test.ts
    _helpers/
      my-helper.ts
      __tests__/
        my-helper.test.ts
```
