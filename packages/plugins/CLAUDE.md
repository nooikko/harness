# Plugin Directory — Developer Notes

All orchestrator plugins live here. Each plugin is a private workspace package that integrates with the orchestrator via the `@harness/plugin-contract` type definitions.

---

## Before adding or modifying a plugin

Read these first:
- `../../.claude/rules/plugin-system.md` — hook semantics, PluginContext API, plugin registration order
- `../../.claude/rules/architectural-invariants.md` — what belongs in a plugin vs. the orchestrator core
- `../plugin-contract/src/index.ts` — source of truth for all types: `PluginDefinition`, `PluginHooks`, `PluginContext`

The cardinal rule: **all side effects go in plugins, never in the orchestrator core**. The orchestrator only defines the pipeline and invokes hooks.

---

## Plugin anatomy

```
packages/plugins/<name>/
  package.json         — name: "@harness/plugin-<name>", private: true
  tsconfig.json        — extends ../../../tsconfig.base.json
  vitest.config.ts     — named "plugin-<name>", node environment
  src/
    index.ts           — PluginDefinition export (named `plugin`)
    _helpers/
      <helper>.ts      — one export per file, named to match filename
      __tests__/
        <helper>.test.ts
```

The export from `src/index.ts` is always named `plugin`:
```typescript
export const plugin: PluginDefinition = { ... };
```

The orchestrator's `plugin-registry` imports each plugin by this name.

---

## Hooks reference

| Hook | When | Blocking? | Can modify? |
|------|------|-----------|-------------|
| `onMessage` | Step 1 — message received | No | No |
| `onBeforeInvoke` | Step 3 — before Claude | Yes (chain) | Yes — returns modified prompt |
| `onAfterInvoke` | Step 5 — after Claude | No | No |
| `onPipelineComplete` | After all DB writes in sendToThread | No | No |
| `onCommand` | Step 7 — /command parsed | Yes (first-wins) | Returns true to consume |
| `onBroadcast` | Any `ctx.broadcast()` call | No | No |
| `onTaskCreate` | Delegation — task created | No | No |
| `onTaskComplete` | Delegation — task validated | No | No |
| `onTaskFailed` | Delegation — max iterations | No | No |

---

## Fire-and-forget pattern

Plugins that do expensive async work (invoking Claude, writing DB records) should never block the pipeline. Use `void` with an inner try/catch:

```typescript
const doWorkInBackground = async (ctx: PluginContext, threadId: string) => {
  try {
    // ... async work
  } catch (err) {
    ctx.logger.warn(`plugin-name: failed [thread=${threadId}]: ${err}`);
  }
};

// In the hook:
void doWorkInBackground(ctx, threadId);
```

The summarization, auto-namer, and audit plugins all follow this pattern.

---

## Duplicate guards

Background work that must not run twice uses a recency check before starting:

```typescript
const recent = await ctx.db.someTable.findFirst({
  where: { threadId, createdAt: { gte: new Date(Date.now() - 60_000) } },
});
if (recent) return;
```

60 seconds is the standard guard window. Adjust only if the work is expected to take longer.

---

## Registration

Plugins are registered in `apps/orchestrator/src/plugin-registry/index.ts` via the `ALL_PLUGINS` array. Order matters for hooks that run sequentially — see the plugin-system rules for the current order and rationale.

New plugins also need to be added as workspace dependencies in `apps/orchestrator/package.json` and their vitest config added to the root `vitest.config.ts` projects list.

---

## Current plugins

| Package | Hook(s) | Purpose |
|---------|---------|---------|
| `@harness/plugin-context` | `onBeforeInvoke` | Injects context files + conversation history |
| `@harness/plugin-discord` | `start` / `stop` | Discord gateway adapter |
| `@harness/plugin-web` | `start` / `stop` / `onBroadcast` | HTTP server, WebSocket broadcaster |
| `@harness/plugin-delegation` | `onCommand` + tools | `/delegate`, `/checkin` commands |
| `@harness/plugin-metrics` | `onAfterInvoke` | Token usage + cost records |
| `@harness/plugin-summarization` | `onAfterInvoke` | Conversation compression every 50 messages |
| `@harness/plugin-auto-namer` | `onMessage` | Auto-generates thread title after first message |
| `@harness/plugin-audit` | `onBroadcast` | Extracts conversation to ThreadAudit then deletes |
| `@harness/plugin-time` | `onBeforeInvoke` + tools | Injects current timestamp, exposes `current_time` tool |
| `@harness/plugin-validator` | `onTaskComplete` | Quality-gates delegation outputs via rubric |
| `@harness/plugin-activity` | `onPipelineComplete` | Persists pipeline steps, thinking blocks, tool calls |
