# Harness — Product Requirements Document

## Overview

A thin orchestration layer that keeps Claude Code CLI as the agent runtime, adding persistent conversation threads, sub-agent delegation, cron-scheduled invocations, and interface adapters. The agent's behavior is defined entirely in CLAUDE.md — code is plumbing only.

**Everything beyond the core pipeline is a plugin.** Discord is a plugin. Web dashboard is a plugin. Cron scheduling is a plugin. Microsoft Graph is a plugin. The core is a message pipeline with hooks that plugins attach to. You never modify the core to add capabilities — you write a plugin.

### Philosophy

The agent is the product. Code handles: process management, the message pipeline, database persistence, and plugin lifecycle. Everything else — memory, calendar awareness, email awareness, cross-thread awareness, proactive alerts — is agent behavior defined in CLAUDE.md and context files the agent manages itself.

---

## **CRITICAL ENGINEERING CONSTRAINTS**

### **DO NOT CREATE A `types.ts` FILE. EVER.**

Types are **co-located with their source**. If `discord/index.ts` creates a Discord-specific interface, that interface is exported from `discord/index.ts`. If the orchestrator's `index.ts` defines an `IncomingMessage` shape, it's exported from there. Prisma models generate their own types — **USE THEM DIRECTLY** via `import type { Thread, Message, Task } from "database"`. If you find yourself creating a centralized `types.ts` that re-declares shapes Prisma already exports, you are doing it wrong. The only exception is a narrowly-scoped type that genuinely has no single source file (rare).

### File Organization: Co-location, Isolation, Orchestration

Three tenets govern all file organization in this project. They are not about line counts — they are about **purpose**.

**1. Co-location.** Everything related to a concern lives together in one directory module. A module is a directory with an `index.ts` and internal subdirectories. If you need to understand how Discord works, you open `packages/plugins/discord/` and everything is there — the adapter logic, the message conversion, the channel resolution. You don't chase imports across the codebase.

**2. Isolation.** Every file has one purpose. Every `_helpers/` file is a discrete, testable unit with no bleed into other concerns. Prompt assembly is not in the same file as response parsing. The cron scheduler is not in the same file as the admin command handlers. You split on **purpose**, not on length. If a file does two fundamentally different things, it's two files — whether it's 50 lines or 500.

**3. Orchestration.** A module's `index.ts` is the orchestrator — it takes the isolated pieces from `_helpers/` and `_components/`, wires them together, and exports the public API. It is NOT a barrel file that re-exports. It contains the actual coordination logic: "load these, connect them like this, expose this interface."

**Structure pattern:**

```
module-name/
  index.ts                → ORCHESTRATION. Wires internals together, exports public API.
  __tests__/              → Tests for this module's index.ts.
    index.test.ts
  _helpers/               → ISOLATED logic. Each file = one testable purpose.
    prompt-assembler.ts   → Assembles prompts. That's it.
    response-parser.ts    → Parses responses. That's it.
    __tests__/            → Tests for helpers in this directory.
      prompt-assembler.test.ts
      response-parser.test.ts
  _components/            → ISOLATED sub-modules (when applicable).
    command-router.ts     → Routes commands. That's it.
```

**Test placement:** Tests live in `__tests__/` folders within the directory they test. A module's `index.test.ts` goes in `module-name/__tests__/index.test.ts`. A helper's test goes in `module-name/_helpers/__tests__/helper-name.test.ts`. Tests are never placed directly alongside source files.

**Rules:**

1. **`_` prefix = private to the module.** Nothing outside the module imports from `_helpers/` or `_components/`. The module's `index.ts` is the only public surface.
2. **Split on purpose, not on length.** A file that does two different things is two files. A file that does one thing well stays one file regardless of how long it is.
3. **`index.ts` is orchestration, not a barrel.** It coordinates. It wires. It delegates. It does NOT just `export * from "./thing"`.
4. **Types follow the same three tenets.** Types are **isolated** in the file that generates them — if `message-adapter.ts` creates a `PipelineMessage` type, that type is exported from `message-adapter.ts`. They are **co-located** with the logic that produces them. They are **orchestrated** through imports at the `index.ts` level, which re-exports only the types that are part of the module's public API. Never create standalone type files. Never re-declare types that Prisma already generates.
5. **Tests live in `__tests__/` folders.** Every directory that has testable code gets a `__tests__/` subdirectory. Never place test files directly alongside source files.

### Code Style: Arrow Functions with Named Type Signatures

Use arrow functions everywhere. No `function` keyword declarations. This applies to exports, callbacks, helpers, and module-level definitions.

**Prefer named type signatures.** Define the function's type as a PascalCase type, then annotate the camelCase const with it. The function body doesn't redeclare parameter or return types — the type annotation handles that.

```typescript
// CORRECT — type signature defined separately, function annotated
type ParseResponse = (raw: string) => { command: Command | null; userMessage: string };

const parseResponse: ParseResponse = (raw) => {
  // TypeScript infers parameter types and return type from ParseResponse
};

type HandleMessage = (input: IncomingMessage) => Promise<void>;

export const handleMessage: HandleMessage = async (input) => {
  // ...
};

// WRONG — inline type annotations on the function itself
export const handleMessage = async (input: IncomingMessage): Promise<void> => {
  // ...
};

// WRONG — function keyword
export async function handleMessage(input: IncomingMessage) {
  // ...
}
```

**Exception:** When generics make the separate type definition awkward or unreadable, inline annotations are acceptable. Use judgment — if the generic version is clearer inline, keep it inline.

### File Naming: kebab-case Only

All file names must be kebab-case. A Claude Code hook actively blocks file creation with PascalCase or camelCase names. This is enforced at the tooling level — you cannot create a file that violates this.

```
CORRECT: message-adapter.ts, channel-resolver.ts, plugin-loader.ts, ws-broadcaster.ts
WRONG:   MessageAdapter.ts, channelResolver.ts, pluginLoader.ts, WSBroadcaster.ts
```

Exceptions: `CLAUDE.md`, `README.md`, `LICENSE`, and files in `AI_RESEARCH/`.

### Package Build Strategy

All packages (except `packages/database`, which relies on Prisma's generated client) must be built and exported as dual CJS/ESM using `tsup` (or equivalent: esbuild + rollup). The output is:

- `dist/index.js` — CJS bundle
- `dist/index.mjs` — ESM bundle
- `dist/index.d.ts` — Single rolled-up type declaration

Each package's `package.json` uses the `exports` field to map these:

```json
{
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

This applies to `packages/ui`, `packages/mcp-graph`, and any future packages. The `apps/` (orchestrator, dashboard) are not published packages — they consume packages but don't need dual builds themselves.

### Import Style

**Always import from the module directory, never from internal files.**

```typescript
// CORRECT — import from the module
import { handleMessage } from "@/orchestrator";
import type { PluginContext } from "@/orchestrator";
import { createInvoker } from "@/invoker";

// WRONG — reaching into internals
import { parseResponse } from "@/orchestrator/_helpers/response-parser";
import { buildToolFilter } from "@/invoker/_helpers/tool-filter";
```

**Never use `.js` or `.ts` file extensions in import paths.** Import from directories (which resolve to `index.ts`) or bare module names. The bundler/runtime resolves extensions.

```typescript
// CORRECT
import { prisma } from "database";
import { cn } from "ui";
import { plugin as discordPlugin } from "@harness/plugin-discord";

// WRONG
import { prisma } from "database/src/index.js";
import { cn } from "ui/src/utils.ts";
```

### `claude -p` and MCP Server Considerations

Every `claude -p` invocation is a **cold start** — it must discover and connect to MCP servers each time. This has real latency and resource cost. Design implications:

- **Do NOT rely on MCP tools for high-frequency operations** in the orchestrator core loop. Reading/writing context files should use direct `fs` calls, not Claude's file tools.
- **MCP servers are for the AGENT's use**, not the orchestrator's. The orchestrator invokes `claude -p`, and the agent inside that invocation uses MCP tools (Graph calendar/email). The orchestrator itself never calls MCP tools directly.
- **Keep sub-agent prompts self-contained.** Each `claude -p` invocation knows nothing about previous invocations. All necessary context must be in the prompt.
- **Consider `--allowedTools` to limit MCP overhead.** If a sub-agent only needs to write files, don't load the Graph MCP server. The invoker should accept tool restrictions and pass them through.

### Review Standards

Every component must be evaluated against these questions before being considered complete:

1. **Does it duplicate something Prisma already provides?** If yes, delete it and use the Prisma export.
2. **Are types co-located with their source module?** If a type lives in a different file than the code that creates/consumes it, justify why.
3. **Is the orchestrator doing agent work?** The orchestrator is plumbing. If it's making decisions the agent should make, move that logic to CLAUDE.md.
4. **Does it survive a cold start?** Every `claude -p` call starts fresh. No in-memory state carries over between invocations.
5. **Is it the minimum code needed?** No abstractions for one-time operations. No utility files for single-use helpers.
6. **Is it a plugin?** If a capability is not part of the core message pipeline (receive → persist → assemble → invoke → parse → respond → log), it must be a plugin. No exceptions.

---

## Architecture Decisions

- **Monorepo integration**: Fits into existing pnpm + Turborepo monorepo
- **Plugin-first**: The core is a pipeline with lifecycle hooks. All interfaces, schedulers, and integrations are plugins.
- **Dashboard**: Next.js (consistent with monorepo), not React + Vite
- **Database**: Extend existing `packages/database/` Prisma schema (one Postgres, one client)
- **MCP server**: `packages/mcp-graph/` as a monorepo package

### Project Structure

```
apps/
  orchestrator/                    → Core Node.js service
    src/
      index.ts                     → Boot: load config, import plugins, start pipeline
      config.ts                    → Environment variables and defaults
      orchestrator/                → THE message pipeline (directory module)
        index.ts                   → Pipeline orchestration: receive → hooks → invoke → parse → respond
        _helpers/
          prompt-assembler.ts      → Assembles prompt from hook contributions
          response-parser.ts       → Parses [COMMAND] blocks from agent output
          command-router.ts        → Routes parsed commands to registered handlers
      invoker/                     → Claude CLI subprocess management
        index.ts                   → Spawn `claude -p`, manage timeout, capture output
        _helpers/
          tool-filter.ts           → Builds --allowedTools flags per invocation context
      plugin-loader/               → Plugin lifecycle management
        index.ts                   → Validate, register, start, stop (receives plugins array)
        _helpers/
          validate-plugin.ts       → Validates plugin exports match contract
      plugin-registry/             → Static plugin imports
        index.ts                   → Imports all plugin packages, exports getPlugins()
  dashboard/                       → Next.js web dashboard
  web/                             → Existing template app (unchanged)
packages/
  plugin-contract/                 → Plugin API surface types (@harness/plugin-contract)
    src/index.ts                   → PluginContext, PluginHooks, PluginDefinition, config types
  plugins/                         → Organizational folder (no code, no package.json with logic)
    context/                       → @harness/plugin-context (independent workspace package)
      src/
        index.ts                   → Registers onBeforeInvoke hook
        _helpers/
          file-reader.ts           → Reads context/*.md files via fs
          history-loader.ts        → Loads conversation history from Postgres
    discord/                       → @harness/plugin-discord (independent workspace package)
      src/
        index.ts                   → Registers message source + reply sink
        _helpers/
          message-adapter.ts       → Converts Discord.js messages to pipeline format
          channel-resolver.ts      → Resolves channels/threads to sourceIds
    web/                           → @harness/plugin-web (independent workspace package)
      src/
        index.ts                   → Registers message source + broadcast sink + REST API
        _helpers/
          routes.ts                → Express route definitions
          ws-broadcaster.ts        → WebSocket event broadcasting
  database/                        → Extended Prisma schema
  ui/                              → Shared UI library
  mcp-graph/                       → Microsoft Graph MCP server
context/                           → Agent-managed markdown files (project root)
```

**Note:** Future plugins (cron, delegation, validation, worktree) will also be independent packages under `packages/plugins/`. Plugin-specific dependencies (discord.js, express, ws, cors, node-cron) live in their respective plugin package, not in the orchestrator.

**This structure is not optional.** Every module is a directory. Every directory has an `index.ts` that orchestrates. Separate concerns go in separate files under `_helpers/`. Split on purpose, not on length.

### Dependency Flow

- `apps/orchestrator` imports from `packages/database`, `packages/plugin-contract`, and each plugin package (`@harness/plugin-context`, `@harness/plugin-discord`, `@harness/plugin-web`)
- Plugin packages import from `@harness/plugin-contract` and `packages/database` — never from the orchestrator
- `apps/dashboard` imports from `packages/database` and `packages/ui`
- `packages/mcp-graph` is standalone (runs as separate process via MCP protocol)
- `context/` is read/written by the agent at runtime (not imported by any package)
- `packages/plugin-contract` is the shared API surface — it defines `PluginContext`, `PluginHooks`, `PluginDefinition`, and config types. All plugin packages depend on it.

---

## Plugin System

### Core Concept

The orchestrator exposes a set of **lifecycle hooks** that plugins attach to. Each plugin is an independent workspace package under `packages/plugins/` with its own `package.json`, dependencies, and test configuration. Plugins export a `register` function. The orchestrator imports them statically via a plugin registry (`src/plugin-registry/index.ts`) and calls their `register` function with a `PluginContext` object.

### Plugin Context (what the core gives to every plugin)

The `PluginContext` is the API surface plugins use to interact with the core. It provides:

- **`onMessage(handler)`** — Register as a message source. The handler receives messages from the plugin's interface and feeds them into the pipeline.
- **`sendMessage(threadId, content)`** — Push the pipeline's response back through the plugin's interface.
- **`sendToThread(threadId, content, role)`** — Write a message directly to any thread (used for cross-thread notifications). The delegation plugin uses this to notify the parent thread when a task completes. The message is persisted to Postgres and broadcast to connected clients.
- **`onBeforeInvoke(hook)`** — Modify the assembled prompt before `claude -p` is called. Used by the context plugin to inject memory/world-state, or by any plugin that needs to add context.
- **`onAfterInvoke(hook)`** — Process the raw agent response before it's parsed. Used for logging, metrics, or response transformation.
- **`onCommand(type, handler)`** — Register a handler for a specific `[COMMAND]` type parsed from agent output. The delegation plugin registers "delegate" and "re-delegate". The cron plugin registers "cron_create", "cron_update", etc. Any plugin can add new command types without touching the core. See **Two-Layer Command Model** below for the distinction between user-facing slash commands and agent-emitted `[COMMAND]` blocks.
- **`onTaskCreate(handler)`** — Fires when a delegation task is created, before the sub-agent is invoked. The handler receives the Task record and can modify context (e.g., the worktree plugin sets the working directory). Handlers can return enriched context that's passed to the sub-agent.
- **`onTaskComplete(handler)`** — Fires when a sub-agent reports work as done, BEFORE the task is marked as accepted. This is the validation gate. The handler can return `{ accepted: true }` to proceed or `{ accepted: false, feedback: "..." }` to re-delegate. Multiple handlers run in sequence — ALL must accept for the task to pass.
- **`onTaskValidated(handler)`** — Fires after all `onTaskComplete` handlers accept. The task is now truly done. The worktree plugin merges the branch. The delegation plugin sends the cross-thread notification.
- **`onTaskFailed(handler)`** — Fires if validation exhausts max iterations or encounters an unrecoverable error. The worktree plugin cleans up. The delegation plugin notifies the parent thread of failure.
- **`onBroadcast(handler)`** — Listen for pipeline events (new message, task update, cron run). The web plugin uses this for WebSocket broadcasting.
- **`broadcast(event)`** — Emit an event to all registered broadcast listeners.
- **`db`** — Prisma client instance. Plugins can query/write to the database.
- **`invoker`** — Access to the Claude CLI invoker for plugins that need to spawn sub-agents (delegation plugin).
- **`config`** — Resolved configuration object.
- **`logger`** — Scoped logger instance (prefixed with plugin name).

### Two-Layer Command Model

Commands operate at two distinct layers in the pipeline:

**Layer 1: User-facing slash commands.** Users type `/delegate research X` or `/cron create ...` in Discord or the web chat. These are parsed by the input plugin (Discord, web) before entering the pipeline. Simple admin commands (cron CRUD, thread management) may be handled directly by the plugin without invoking Claude at all. The slash command format is for human ergonomics.

**Layer 2: Agent-emitted `[COMMAND]` blocks.** When Claude responds to a pipeline invocation, it may include structured command blocks in its output:

```
Here's what I'll do.

[COMMAND type="delegate" model="sonnet"]
Research X thoroughly and write a report summarizing the findings.
[/COMMAND]
```

The response parser (`response-parser.ts`) extracts these blocks after invocation. The command router dispatches each block to the handler registered via `onCommand(type, handler)`. This format supports structured parameters (type, model, etc.) and multi-line content naturally.

**Key distinction:** Slash commands are user input parsed by plugins. `[COMMAND]` blocks are agent output parsed by the core pipeline. They are different parsers at different points in the flow. A user typing `/delegate` in Discord and the agent emitting `[COMMAND type="delegate"]` both end up dispatched to the delegation plugin's handler, but they enter through different paths.

### Plugin Lifecycle

1. **Import**: At boot, the plugin registry (`src/plugin-registry/index.ts`) statically imports all plugin packages (`@harness/plugin-context`, `@harness/plugin-discord`, `@harness/plugin-web`) and returns them as an array. No filesystem scanning.
2. **Validation**: The plugin loader validates each plugin's exports match the contract (has `name`, `version`, `register`).
3. **Registration**: Each plugin's `register(ctx: PluginContext)` is called. Plugins attach their hooks.
4. **Start**: After all plugins register, the core calls `start()` on each plugin (if exported). This is where Discord connects, Express starts listening, cron jobs load, etc.
5. **Runtime**: The message pipeline runs. Plugins feed messages in, hooks fire in order, responses flow back out.
6. **Shutdown**: On SIGTERM/SIGINT, the core calls `stop()` on each plugin (if exported) for graceful cleanup.

### Plugin Contract

Every plugin exports from its `index.ts`:

```typescript
// Required
export const register: Register = (ctx) => {
  // attach hooks, command handlers, etc.
};

// Optional
export const start: Start = async () => { /* connect, listen, load */ };
export const stop: Stop = async () => { /* graceful cleanup */ };

// Plugin metadata
export const name = "discord";
export const version = "1.0.0";
```

### Why This Matters

- **Adding a Slack adapter** = new plugin package at `packages/plugins/slack/`, implements `register` with `onMessage`/`sendMessage`, add to plugin registry. Zero core changes.
- **Adding a time/timezone utility** = new plugin package that registers an `onBeforeInvoke` hook to inject current time into every prompt. Zero core changes.
- **Adding Notion integration** = new MCP server in `packages/mcp-notion/` + optionally a plugin that registers a cron to sync. Zero core changes.
- **Removing Discord** = remove the plugin package and its import from the registry. Zero core changes.

---

## Component Specifications

### 1. Database Schema Extension (`packages/database`)

Add the following models to the existing Prisma schema at `packages/database/prisma/schema.prisma`. The existing User/Post models remain unchanged.

**New models:**

- **Thread**: Conversation threads from any source
  - `id` (cuid), `source` (string — plugin name, e.g., "discord", "web", "cron"), `sourceId` (channel ID, session ID, cron job ID), `name`, `kind` (string: "primary" | "task" | "cron" | "general"), `parentThreadId` (nullable — links task threads back to the thread that spawned them), `status` (active/idle/archived), `lastActivity`, `createdAt`
  - Unique constraint on `[source, sourceId]`
  - Has many Messages and Tasks
  - Self-referential relation: `parentThread` / `childThreads` for cross-thread awareness

- **Message**: Individual messages within a thread
  - `id` (autoincrement), `threadId`, `role` (user/assistant/system), `content` (text), `timestamp`
  - Index on `[threadId, timestamp]`

- **Task**: Sub-agent delegation tasks
  - `id` (cuid), `threadId`, `status` (pending/running/evaluating/completed/failed), `originalMessage`, `subAgentPrompt`, `model`, `currentIteration` (default 0), `maxIterations` (default 5), `result` (nullable), `createdAt`, `completedAt`
  - Indexes on `status` and `threadId`
  - Has many AgentRuns

- **AgentRun**: Tracks every Claude CLI invocation for metrics
  - `id` (autoincrement), `taskId` (nullable), `model`, `promptTokensEst`, `resultTokensEst`, `durationMs`, `success` (default true), `timestamp`
  - Indexes on `timestamp` and `model`

- **CronJob**: Scheduled agent invocations stored in Postgres
  - `id` (cuid), `name`, `schedule` (cron expression in UTC), `prompt` (what to tell the agent), `channelId` (where to report results), `timezone` (default America/Phoenix), `enabled` (default true), `lastRun`, `lastResult`, `createdAt`

- **Metric**: Generic metrics/telemetry
  - `id` (autoincrement), `name` (invocation/tokens/task_complete/cron_run/etc.), `value` (float), `metadata` (JSON), `timestamp`
  - Index on `[name, timestamp]`

### 2. Core Orchestrator (`apps/orchestrator`)

A Node.js service (NOT Next.js) that runs as a long-lived process. The core is intentionally small — just the message pipeline and plugin infrastructure.

**Core modules (these are the ONLY modules that aren't plugins):**

- `src/index.ts` — Boot sequence: load config, import plugins from registry, call register on each, call start on each. Graceful shutdown on SIGTERM.
- `src/config.ts` — Environment variables and defaults. Exported for plugins to consume.
- `src/orchestrator/` — THE message pipeline. `index.ts` orchestrates the flow: receive → onBeforeInvoke hooks → invoke → onAfterInvoke hooks → parse → route commands → respond → broadcast. Exports the `PluginContext` interface. Internal `_helpers/` handle prompt assembly, response parsing, and command routing as separate concerns.
- `src/invoker/` — Claude CLI subprocess management. `index.ts` spawns `claude -p <prompt> --model <model> --output-format text`. Internal `_helpers/` handle `--allowedTools` flag construction per invocation context. Handles timeout, stdout/stderr capture.
- `src/plugin-loader/` — Plugin lifecycle management. `index.ts` receives a plugins array (from the registry), validates exports against the contract, manages register → start → stop. Internal `_helpers/` handle export validation.
- `src/plugin-registry/` — Static plugin imports. `index.ts` imports `@harness/plugin-context`, `@harness/plugin-discord`, `@harness/plugin-web` and exports `getPlugins()`.

**Plugin contract** lives in `packages/plugin-contract/` (`@harness/plugin-contract`) — a shared workspace package that defines `PluginContext`, `PluginHooks`, `PluginDefinition`, `OrchestratorConfig`, `InvokeOptions`, and `InvokeResult`. All plugin packages and the orchestrator depend on it.

**No `types.ts`.** Prisma types come from `"database"`. Each plugin exports its own types from its own `index.ts`. Shared plugin types come from `@harness/plugin-contract`.

**Core dependencies (minimal):** `@prisma/client`, `@harness/plugin-contract`, plugin packages (all `workspace:*`), `tsx` (dev). Interface-specific deps (discord.js, express, ws, cors, node-cron) live in their respective plugin packages, not in the orchestrator.

### 3. Built-in Plugins

Each plugin is an independent workspace package under `packages/plugins/` with its own `package.json`, dependencies, tests, and `vitest.config.ts`. They follow the exact same plugin contract as any third-party plugin would.

#### 3a. Discord Plugin (`packages/plugins/discord/` — `@harness/plugin-discord`)

- Registers as a message source via `onMessage`
- Implements `sendMessage` to reply in the originating channel/thread
- On `start()`: connects Discord.js client, sets up message listener
- On `stop()`: disconnects gracefully
- Requires `DISCORD_TOKEN` env var
- Exports Discord-specific types (e.g., channel mapping config) from its own `index.ts`

#### 3b. Web Plugin (`packages/plugins/web/` — `@harness/plugin-web`)

- Registers as a message source (HTTP POST `/api/chat`) and event sink (`onBroadcast` → WebSocket)
- On `start()`: starts Express server + WebSocket on configured port
- Provides REST API endpoints for the dashboard (threads, tasks, crons, metrics, context files)
- The dashboard (`apps/dashboard`) talks to these endpoints
- Requires `PORT` env var (default 3001)

#### 3c. Cron Plugin (`packages/plugins/cron/` — future `@harness/plugin-cron`)

- On `start()`: loads CronJob records from Postgres, schedules with node-cron
- Registers command handlers for `cron_create`, `cron_update`, `cron_delete`, `cron_toggle`
- When a cron fires: creates a synthetic message and feeds it into the pipeline via `onMessage`
- Exposes a `reloadCrons()` function called after admin commands mutate the CronJob table
- Requires `node-cron` dep (scoped to this plugin)

#### 3d. Delegation Plugin (`packages/plugins/delegation/` — future `@harness/plugin-delegation`)

- Registers command handlers for `delegate` and `re-delegate`
- Uses `ctx.invoker` to spawn sub-agents
- Manages the delegation loop: invoke → fire `onTaskComplete` hooks (validation gate) → re-delegate if rejected or finalize if accepted
- Writes Task and AgentRun records to Postgres
- Creates a `task` thread with `parentThreadId` for each delegation, so sub-agent work has its own conversation history
- Fires `onTaskCreate` before first invocation (worktree plugin hooks here)
- Fires `onTaskComplete` when sub-agent reports done (validation plugin hooks here)
- Fires `onTaskValidated` when all `onTaskComplete` handlers accept (worktree plugin merges, cross-thread notification sent)
- Fires `onTaskFailed` if max iterations exhausted (worktree plugin cleans up)
- Broadcasts task status updates via `ctx.broadcast`
- The delegation plugin itself does NOT validate work and does NOT manage worktrees — it fires hooks and other plugins handle those concerns

#### 3e. Context Plugin (`packages/plugins/context/` — `@harness/plugin-context`)

- Registers an `onBeforeInvoke` hook that reads context files (memory.md, world-state.md, thread-summaries.md, inbox.md) and injects them into the prompt
- Uses direct `fs` calls (NOT MCP tools) for performance
- Loads conversation history from Postgres and appends to prompt
- This is what makes the agent "aware" — without this plugin, the agent gets raw messages with no context

#### 3f. Validation Plugin (`packages/plugins/validation/` — future `@harness/plugin-validation`)

The adversarial reviewer. This plugin ensures that no agent validates its own work. When a task completes, a completely separate agent reviews it.

- Registers an `onTaskComplete` handler — this is the quality gate
- Spawns a **different** `claude -p` invocation with a reviewer prompt, NOT the agent that did the work
- The reviewer agent checks ALL of the following (not a subset, ALL):
  - Do tests pass? (`pnpm test` or equivalent)
  - Does lint pass? (`pnpm lint`)
  - Does formatting pass? (`pnpm check`)
  - Does the build succeed? (`pnpm build`)
  - Were tests actually written? Are they meaningful, not just pass-to-pass stubs?
  - Is test coverage adequate for the changes made?
  - Is mocking kept to a minimum? Are we testing real behavior or mocked behavior?
  - Are imports correct? No reaching into `_helpers/` from outside a module?
  - Are types co-located? No centralized type files?
  - Do new dependencies introduce fragility?
  - Does the code follow the project's patterns (arrow functions, kebab-case, directory modules)?
- Returns `{ accepted: true }` or `{ accepted: false, feedback: "specific actionable feedback" }`
- On rejection: the feedback is fed back to the original sub-agent via re-delegation with explicit instructions on what to fix
- The reviewer uses a different model or at minimum a different system prompt than the worker — it is structurally incapable of rubber-stamping its own work
- The validation loop has its own iteration budget (separate from the delegation loop's `maxIterations`)

#### 3g. Worktree Plugin (`packages/plugins/worktree/` — future `@harness/plugin-worktree`)

Manages git worktree lifecycle for task isolation. Every delegated task gets its own branch and working directory. Work is merged only after validation passes.

- Registers `onTaskCreate` — creates a git worktree for the task
  - Worktree path: `.claude/worktrees/<task-id>/`
  - Branch: `task/<task-id>`
  - Runs `pnpm install` in the worktree
  - Enriches the task context with the worktree path so the sub-agent's `cwd` is set to the worktree
- Registers `onTaskValidated` — merges the worktree branch back
  - Merges `task/<task-id>` into the base branch
  - Removes the worktree and branch
  - If merge conflicts: marks task as needing manual resolution, notifies parent thread
- Registers `onTaskFailed` — cleans up
  - Removes the worktree and branch
  - No merge, work is discarded (user can recover from git reflog if needed)
- The delegation plugin and validation plugin don't know worktrees exist — they just see a `cwd` in the task context

### 4. Web Dashboard (`apps/dashboard`)

Next.js 16 App Router application. Reads from the same Postgres database as the orchestrator. Connects to the orchestrator's WebSocket (provided by the web plugin) for real-time updates.

#### Server-First Architecture (NON-NEGOTIABLE)

This dashboard is built with Next.js 16 server capabilities. The vast majority of components are Server Components. `"use client"` is used ONLY for interactive elements that require browser APIs, event handlers, or state. If a page can be rendered on the server, it is rendered on the server.

**Patterns to use:**

- **Data fetching in Server Components directly.** Pages `async` fetch from Prisma on the server. No `useEffect`. No client-side data fetching libraries. No loading spinners driven by `useState`.
  ```tsx
  // app/tasks/page.tsx — Server Component, no directive
  const TasksPage = async () => {
    const tasks = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });
    return <TaskList tasks={tasks} />;
  };
  export default TasksPage;
  ```

- **Suspense with promises for streaming.** Start async work in Server Components without awaiting. Pass the promise to a Client Component. Use React's `use()` hook to resolve. Wrap in `<Suspense>` for loading states.
  ```tsx
  const Page = () => {
    const metrics = getMetrics(); // NOT awaited
    return (
      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsDisplay metrics={metrics} />
      </Suspense>
    );
  };
  export default Page;
  ```

- **`loading.tsx` for route-level loading states.** Drop a `loading.tsx` in any route folder. Next.js wraps the page in `<Suspense>` automatically.

- **Server Actions for mutations.** Form submissions, cron toggling, thread management — all via Server Actions with `"use server"`. Use `revalidatePath` / `revalidateTag` after mutations. No API routes for CRUD.
  ```tsx
  // app/actions/crons.ts
  "use server"
  type ToggleCron = (id: string, enabled: boolean) => Promise<void>;
  export const toggleCron: ToggleCron = async (id, enabled) => {
    await prisma.cronJob.update({ where: { id }, data: { enabled } });
    revalidatePath("/crons");
  };
  ```

- **URL-based state management.** Filters, pagination, sorting, active chat selection — all managed via `searchParams`. Pages are shareable and server-renderable. No `useState` for state that should survive a page refresh.

- **`"use client"` ONLY for:** WebSocket connections (real-time message streaming), chat input with typing, interactive controls (dropdowns, toggles that need immediate feedback), and `useSearchParams`/`useRouter` for URL manipulation.

#### Multi-Chat Architecture

The dashboard supports multiple concurrent chat threads, modeled after the Claude app's conversation list. One thread is the user's **primary assistant** — always present, always reachable. Other threads are purpose-specific (coding tasks, research, etc.) and can be created/archived freely.

**Thread kinds:**

- **`primary`**: The user's main personal assistant thread. There is exactly one. It is always visible in the sidebar. Other threads can send messages to it (cross-thread notifications). This is where the agent proactively surfaces information — meeting reminders, task completions, urgent emails.
- **`task`**: Created when the user (or the primary thread) kicks off a focused task. Has a `parentThreadId` linking back to the thread that spawned it. When the task thread's work is complete and validated, it sends a notification message to the parent thread (usually primary).
- **`cron`**: System-generated threads for cron job output. Read-only from the user's perspective.
- **`general`**: User-created conversations for anything else.

**Cross-thread communication flow:**

1. User is in primary thread, says "go research X and write a report"
2. Primary thread's agent issues a `delegate` command, which creates a Task
3. The delegation plugin creates a new `task` thread with `parentThreadId` pointing to the primary thread
4. Sub-agent work happens in the task thread (multiple iterations if needed)
5. When the task thread's agent is satisfied with the result, it sends a cross-thread message to the parent: "Task complete: [summary]. Ready for your review."
6. That message appears in the primary thread as a system notification
7. User can click through to the task thread to review the full work

**Cross-thread message model:** A Message with `role: "system"` and metadata indicating it's a cross-thread notification. The Message record lives in the destination thread (primary). It includes the source `threadId` so the dashboard can render a "View thread" link.

**Dashboard chat UI:**

- **Sidebar**: Thread list showing all threads. Primary is pinned at top. Active threads sorted by `lastActivity`. Badge count for unread messages per thread. Thread kind indicated by icon/label.
- **Main area**: Active thread's message history. Streaming responses via WebSocket. Chat input at bottom.
- **Thread creation**: "New chat" button creates a `general` thread. Task threads are created by the system (delegation), not manually.
- **URL structure**: `/chat/[threadId]` — each thread is a URL. Active thread is a route param, not client state. Server Component loads thread history, Client Component handles the WebSocket stream and input.

**Dependencies:** Reuses `packages/database` for Prisma client, `packages/ui` for shared components.

### 5. Microsoft Graph MCP Server (`packages/mcp-graph`)

Standalone MCP server that wraps Microsoft Graph API for calendar and email access. Registered in `.mcp.json` so Claude Code picks it up natively. This is NOT an orchestrator plugin — it's a tool the agent uses during `claude -p` invocations.

**Tools exposed:**
- `calendar_list_events` — List events for a date range
- `calendar_create_event` — Create a new event
- `calendar_update_event` — Update an existing event by ID
- `mail_list_messages` — List recent messages (inbox, sent, drafts, flagged)
- `mail_send_message` — Send an email
- `mail_search` — Search emails by keyword

**Auth:** OAuth2 via `@azure/msal-node`. Requires Azure app registration with `GRAPH_CLIENT_ID`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_SECRET` env vars.

**Dependencies:** `@modelcontextprotocol/sdk`, `@azure/msal-node`, `@microsoft/microsoft-graph-client`

### 6. Context Directory (`context/`)

Plain markdown files at project root. The agent reads and writes these freely — no schema, no ORM. Guided by instructions in CLAUDE.md. The context plugin reads these via `fs` to inject into prompts.

**Files:**
- `context/memory.md` — Long-term consolidated memory. Kept under 100 lines. Pruned by nightly cron.
- `context/inbox.md` — Daily scratchpad. Agent appends observations. Consolidated into memory.md nightly.
- `context/world-state.md` — Calendar events, email state, system snapshot. Updated by cron via Graph tools.
- `context/thread-summaries.md` — Cross-thread awareness. Updated after each interaction.
- `context/system.md` — Active cron schedules, config, system status.

### 7. Agent Behavior Definition (`CLAUDE.md`)

A CLAUDE.md for the orchestrator context (could be `apps/orchestrator/CLAUDE.md` or a section in the root) that defines:
- How to read/write context files
- Command format for delegation, admin operations, cron management
- Memory management rules (append to inbox, consolidate nightly, keep memory compact)
- Calendar/email awareness (proactive alerts, conflict detection)
- Sub-agent delegation patterns (when to use Haiku vs Sonnet)
- Timezone (MST/America/Phoenix, no DST)
- Personality (direct, no fluff, proactive context references)

---

## Cron Recipes (Seeded Data)

These are stored as CronJob records in Postgres, managed by the cron plugin:

| Name | Schedule (MST) | Purpose |
|------|----------------|---------|
| Morning Digest | 7:00 AM daily | Check calendar + email, update world-state, post briefing to Discord |
| Memory Consolidation | 1:00 AM daily | Merge inbox.md into memory.md, clear inbox |
| Calendar/Email Refresh | Every 30 min | Update world-state.md, alert if urgent |
| Weekly Review | Friday 5:00 PM | Summarize week's accomplishments, post to Discord |

---

## Environment Variables

**Core orchestrator:**
- `DATABASE_URL` — PostgreSQL connection string (shared with existing)
- `CLAUDE_MODEL_DEFAULT` — Default model (claude-sonnet-4-6)

**Discord plugin:**
- `DISCORD_TOKEN` — Discord bot token
- `DISCORD_CHANNEL_ID` — Default channel for cron reports

**Web plugin:**
- `PORT` — Express server port (default 3001)

**Microsoft Graph MCP:**
- `GRAPH_CLIENT_ID` — Azure app client ID
- `GRAPH_TENANT_ID` — Azure tenant ID
- `GRAPH_CLIENT_SECRET` — Azure app client secret

**Dashboard:**
- `DATABASE_URL` — Same Postgres (reads only)
- `NEXT_PUBLIC_WS_URL` — WebSocket URL for real-time updates (e.g., ws://localhost:3001)

---

## Implementation Phases

### Phase 1: Core Pipeline + Plugin System
- Extend Prisma schema with orchestrator models (Thread with `kind` and `parentThreadId`, Message, Task, AgentRun, CronJob, Metric)
- Build the plugin loader (validation, lifecycle: register → start → stop) and plugin registry (static imports)
- Build the orchestrator message pipeline with ALL hook points (onBeforeInvoke, onAfterInvoke, onCommand, onBroadcast, onTaskCreate, onTaskComplete, onTaskValidated, onTaskFailed)
- Build the invoker (Claude CLI subprocess wrapper with --allowedTools support)
- Build the context plugin (reads context files, injects into prompt, loads conversation history)
- Create context directory with starter files
- Write agent CLAUDE.md
- Verify: Can load a plugin, assemble a prompt with context, invoke Claude, get a response

### Phase 2: Discord + Basic Interaction
- Build the Discord plugin (message source + reply sink)
- Build the web plugin (Express + WebSocket, basic REST endpoints)
- Verify: Discord message → orchestrator pipeline → agent response → Discord reply
- Verify: WebSocket broadcasts pipeline events

### Phase 3: Delegation + Validation + Worktrees
- Build the delegation plugin (command handlers for delegate/re-delegate, delegation loop with task lifecycle hooks, Task/AgentRun persistence, cross-thread notifications)
- Build the validation plugin (adversarial reviewer: spawns separate agent, checks tests/lint/build/coverage/quality, returns accept/reject with feedback)
- Build the worktree plugin (creates worktree on task create, merges on validation pass, cleans up on failure)
- Build the cron plugin (load from Postgres, schedule with node-cron, synthetic messages, admin command handlers)
- Seed initial cron jobs
- Verify: "Research X" → worktree created → sub-agent works in isolation → validation agent reviews → worktree merged → result posted to Discord
- Verify: Validation rejection → sub-agent re-delegated with feedback → re-validated
- Verify: "Create a cron for Y" → cron_create command → job stored in DB and scheduled

### Phase 4: Microsoft Graph + Awareness
- Build Microsoft Graph MCP server (calendar + email tools)
- Set up Graph OAuth2 (Azure app registration)
- Register MCP server in .mcp.json
- Configure calendar/email refresh cron
- Configure morning digest cron
- Verify: Agent proactively mentions upcoming meeting from world-state

### Phase 5: Dashboard
- Create Next.js dashboard app (server-first architecture)
- Build multi-chat UI with thread sidebar, primary thread pinned, thread kinds
- Build server-rendered pages (overview, tasks, crons, memory, metrics) — data fetched in Server Components, Suspense for streaming, Server Actions for mutations, URL-based state
- Connect to orchestrator's WebSocket for real-time message streaming (the only `"use client"` boundary)
- Cross-thread navigation: click notification in primary thread → navigate to task thread
- Verify: Full dashboard with live task updates, multi-chat working, cross-thread notifications visible

### Phase 6: Polish
- Thread summaries (cross-thread awareness via Haiku after each interaction)
- Token usage tracking + cost estimation charts
- Error recovery and retry logic
- pm2 / systemd production setup
- Mobile-responsive dashboard
- Plugin documentation (how to write a third-party plugin)
