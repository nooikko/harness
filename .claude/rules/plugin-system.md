# Plugin System

How to add new behavior. How existing plugins work. What the hook system can and cannot do.

**Live plugin contract (zero-drift source of truth):**
@packages/plugin-contract/src/index.ts

---

## Adding New Behavior: The Decision Tree

```
Need new behavior?
    │
    ▼
Does an existing hook fire at the right pipeline step?
    │
    ├── YES → Write a new plugin (or add a hook implementation to an existing one)
    │          See: "Creating a Plugin" below
    │
    └── NO  → Does the pipeline have a step where this SHOULD fire but currently doesn't?
                  │
                  ├── YES → Add a new hook type to packages/plugin-contract/src/index.ts
                  │          Add one hook call in apps/orchestrator/src/orchestrator/index.ts
                  │          Then implement the plugin
                  │
                  └── NO  → Add a new PluginContext method if plugins need new capability
                             Do NOT add logic directly to handleMessage
```

---

## PluginDefinition Shape

File: `packages/plugin-contract/src/index.ts`

```typescript
type PluginDefinition = {
  name: string;
  version: string;
  register: (ctx: PluginContext) => Promise<PluginHooks>;  // Required. Return implemented hooks.
  start?: (ctx: PluginContext) => Promise<void>;           // Optional. After all plugins register.
  stop?: (ctx: PluginContext) => Promise<void>;            // Optional. On graceful shutdown.
  tools?: PluginTool[];                                    // Optional. MCP tools for Claude.
};
```

`register` is called at startup. It receives `PluginContext` and returns only the hooks this plugin implements. Unimplemented hooks are simply omitted from the returned object.

`start` fires after all plugins have registered — use it for things that need other plugins to exist first (e.g., starting an HTTP server, connecting to Discord).

`stop` fires on graceful shutdown.

---

## PluginHooks — All Available Hooks

File: `packages/plugin-contract/src/index.ts`

```typescript
type PluginHooks = {
  onMessage?:       (threadId, role, content) => Promise<void>
  onBeforeInvoke?:  (threadId, prompt) => Promise<string>       // returns modified prompt
  onAfterInvoke?:   (threadId, result: InvokeResult) => Promise<void>
  onCommand?:       (threadId, command, args) => Promise<boolean> // true = handled, stop
  onBroadcast?:     (event, data) => Promise<void>
  onTaskCreate?:    (threadId, taskId) => Promise<void>
  onTaskComplete?:  (threadId, taskId, result) => Promise<void>
  onTaskFailed?:    (threadId, taskId, error) => Promise<void>
};
```

---

## PluginContext — What Every Plugin Receives

File: `packages/plugin-contract/src/index.ts`, line 64

```typescript
ctx.db           // PrismaClient — full DB access
ctx.invoker      // { invoke(prompt, opts?), prewarm?(opts) } — call Claude as sub-agent (prewarm is optional)
ctx.config       // OrchestratorConfig — { port, claudeModel, claudeTimeout, timezone, ... }
ctx.logger       // Logger — .info(), .warn(), .error(), .debug()
ctx.sendToThread // (threadId, content) => Promise<void> — run full pipeline + persist response
ctx.broadcast    // (event, data) => Promise<void> — fan out to all onBroadcast hooks
```

`ctx.sendToThread` runs the complete 8-step pipeline and persists the assistant response.
`ctx.broadcast` reaches the browser via the web plugin's `onBroadcast` implementation.

---

## Plugin Tool Registration (MCP)

Plugins can expose tools to Claude that it can call during invocation.

```typescript
const myPlugin: PluginDefinition = {
  name: 'my-plugin',
  version: '1.0.0',
  tools: [{
    name: 'my_tool',
    description: 'What this tool does',
    schema: { /* JSON Schema for input */ },
    handler: async (ctx, input, meta) => {
      // meta.threadId — current thread
      // meta.taskId  — if running inside a delegation task
      return 'result string';
    },
  }],
  register: async (ctx) => ({ /* hooks */ }),
};
```

Tools are qualified as `pluginName__toolName` (e.g., `delegation__delegate`) when exposed to Claude.
Claude calls them as MCP tools during `invoker.invoke()` within the current session.

File: `apps/orchestrator/src/tool-server/index.ts`

---

## Plugin Registration Order

File: `apps/orchestrator/src/plugin-registry/index.ts`

```typescript
const ALL_PLUGINS = [
  contextPlugin,    // onBeforeInvoke: injects context files + history
  discordPlugin,    // start/stop: Discord gateway
  webPlugin,        // start/stop: HTTP server + WebSocket; onBroadcast: WebSocket fan-out
  delegationPlugin, // onCommand: /delegate, /re-delegate, /checkin
  metricsPlugin,    // onAfterInvoke: records AgentRun token metrics
  timePlugin,       // onBeforeInvoke: replaces /current-time; tool: current_time
];
```

Hook runners iterate in this order. For `onBeforeInvoke` (chain), context runs before time — so context history is injected first, then time can modify the prompt.

For `onCommand` (short-circuit), delegation is the only handler — it returns `true` for its commands and stops.

Plugins can be disabled at runtime via `PluginConfig.enabled` in the database without code changes.

---

## What Each Existing Plugin Owns

### context plugin
**Hook:** `onBeforeInvoke`
**Does:** Injects context/ directory files + conversation history into every prompt.
**Key behavior:** If `thread.sessionId` exists, skips history injection (Claude already has it).

### delegation plugin
**Hook:** `onCommand`
**Tools:** `delegate`, `checkin`
**Does:** Handles `/delegate`, `/re-delegate`, `/checkin` commands. Runs the delegation loop: creates task thread, iterates invoke+validate, notifies parent thread.

### web plugin
**Hook:** `onBroadcast`
**Does:** Fans every `ctx.broadcast()` event to WebSocket clients. Also runs the HTTP server (`POST /api/chat` → `onChatMessage` → fire-and-forget `sendToThread`).

### metrics plugin
**Hook:** `onAfterInvoke`
**Does:** Records token usage and cost estimate as a `Metric` row after each Claude invocation.

### discord plugin
**Lifecycle:** `start` / `stop` only (no PluginHooks)
**Does:** Connects Discord.js gateway, routes incoming messages to threads via `ctx.db` + `ctx.broadcast`.

### time plugin
**Hook:** `onBeforeInvoke`
**Tool:** `current_time`
**Does:** Replaces `/current-time` tokens in prompts with the actual timestamp in configured timezone.
