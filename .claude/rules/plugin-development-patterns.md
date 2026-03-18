---
paths:
  - "packages/plugins/**/*.ts"
  - "packages/plugin-contract/**/*.ts"
---

# Plugin Development Patterns

Learned conventions for authoring harness plugins. Distilled from observed patterns across 15+ plugins.

---

## Tool Handler Scaffolding

Every plugin tool handler follows this sequence:

```
1. Input validation (typeof guards, never type assertions)
2. Agent scope resolution (resolveAgentScope)
3. Existence/state checks (DB lookups)
4. Business logic + constraints
5. Database operations
6. Success message with structured data
```

**Input validation** — use runtime typeof guards, never `as` casts:

```typescript
// Correct
const name = typeof input.name === "string" ? input.name.trim() : "";
if (!name) return "Error: name is required.";

const enabled = typeof input.enabled === "boolean" ? input.enabled : false;

// Wrong — bypasses runtime checks
const name = input.name as string;
```

**Agent scope isolation** — every CRUD handler must filter by agentId:

```typescript
const scopeResult = await resolveAgentScope(ctx, meta);
if (!scopeResult.ok) return scopeResult.error;

// Use findFirst (not findUnique) when filtering by name + agentId
const job = await ctx.db.cronJob.findFirst({
  where: { name, agentId: scopeResult.scope.agentId },
});
```

---

## Module-Level Lifecycle State

Plugins that maintain state across register/start/stop use a typed module-level state object:

```typescript
type PluginState = {
  client: SomeClient | null;
  isConnected: boolean;
};

const state: PluginState = { client: null, isConnected: false };
```

Populate in `start()`, clean in `stop()`, reference in hooks. This avoids closure issues with async initialization and enables clean restart.

---

## Settings Reload

Any plugin that calls `ctx.getSettings()` must implement `onSettingsChange`:

```typescript
const register = async (ctx) => {
  let settings = await ctx.getSettings(settingsSchema);
  return {
    onSettingsChange: async (pluginName: string) => {
      if (pluginName !== "my-plugin") return;
      settings = await ctx.getSettings(settingsSchema);
      ctx.logger.info("my-plugin: settings reloaded");
    },
  };
};
```

---

## Chain Hook Ordering

`onBeforeInvoke` is a chain hook — each plugin receives the previous plugin's transformed prompt. Registration order in `ALL_PLUGINS` determines precedence. Currently: identity (soul) -> context (history) -> time (timestamps). Document ordering assumptions in tests.

---

## Structured Output

Plugin helpers that return display data should return `{ text: string; blocks: Array<{ type: string; data: Record<string, unknown> }> }` — not plain strings. The `text` field is human-readable; `blocks` carry structured data for programmatic access.

---

## Inter-Plugin Communication

Use `ctx.broadcast(event, data)` for plugin-to-plugin notifications. The web plugin's `onBroadcast` fans events to WebSocket clients. Never import one plugin from another — use broadcast events.

---

## API Endpoints

Plugin components that fetch from orchestrator API endpoints should receive `orchestratorUrl` as a prop — never hardcode `/api/plugins/{name}/*`.

---

## Vitest Config

All plugin packages use identical minimal config:

```typescript
export default defineConfig({
  test: {
    name: "plugin-{name}",
    environment: "node",
    coverage: { provider: "v8" },
  },
});
```

---

## Error Handling in Hooks

Wrap hook implementations in try-catch. Log errors with context (threadId, agentId) before swallowing. Never use `.catch(() => {})` without logging. Fire-and-forget operations (`void asyncFn()`) must have explicit error handling — the `runHook` error isolation is a safety net, not a contract.
