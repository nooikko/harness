# Plugin Settings System — Design Document

**Date:** 2026-02-26
**Status:** Approved, pending implementation plan
**Scope:** Plugin settings schema, code generation, web UI, runtime access, isolation, live reload

---

## Problem

Plugins like Discord need runtime configuration (bot token, guild ID). That configuration must be:

- **Editable** from the admin UI without touching code or restarting the process
- **Type-safe** when accessed by plugin code at runtime
- **Isolated** so one plugin cannot read another plugin's settings
- **Encrypted at rest** for secret fields (tokens, keys)
- **Auto-discoverable** so new plugins get a settings UI for free without manual wiring

The current `PluginConfig.settings Json?` field exists in the DB but is untyped and unused.

---

## Architecture Overview

```
packages/plugins/discord/src/_helpers/settings-schema.ts   ← schema definition (pure data)
         ↓
scripts/generate-plugin-registry.ts               ← scans all plugins, generates registry
         ↓
apps/web/src/generated/plugin-settings-registry.ts  ← static embedded data, no plugin imports
         ↓
apps/web/src/app/admin/plugins/[name]/            ← VS Code-style settings UI
         ↓ (Server Action)
DB: PluginConfig.settings                         ← encrypted values at rest
         ↓ (HTTP callback to orchestrator)
POST /api/plugins/:name/reload                    ← web plugin route handler
         ↓
ctx.notifySettingsChange(pluginName)              ← calls onSettingsChange on all plugins
         ↓
onSettingsChange hook                             ← owning plugin reacts (reconnect, reload, etc.)
```

Plugin runtime access:

```
ctx.getSettings(mySchema)  ← scoped closure, typed, decrypts automatically
```

---

## Core Types (plugin-contract)

Add to `packages/plugin-contract/src/index.ts`:

```typescript
type SettingsFieldType = "text" | "password" | "textarea" | "boolean" | "number" | "select";

// Base fields common to all field types
type SettingsFieldBase = {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;  // advisory only — never blocks saving; shows warning UI if empty
  secret?: boolean;    // encrypted at rest, masked in UI, never returned to agent tools
};

// Discriminated union: options only valid when type is "select"
type SettingsFieldScalar = SettingsFieldBase & {
  type: Exclude<SettingsFieldType, "select">;
};

type SettingsFieldSelect = SettingsFieldBase & {
  type: "select";
  options: { label: string; value: string }[];
};

export type PluginSettingsField = SettingsFieldScalar | SettingsFieldSelect;

type SettingsFieldDefs = Record<string, Omit<PluginSettingsField, "name">>;

// TypeScript inference: maps field types to primitives
type InferSettings<T extends SettingsFieldDefs> = {
  [K in keyof T]?: T[K]["type"] extends "boolean" ? boolean
                 : T[K]["type"] extends "number"  ? number
                 : string;
};

type PluginSettingsSchemaInstance<T extends SettingsFieldDefs> = {
  readonly _fields: T;  // underscore: internal plumbing — use toFieldArray() externally
  toFieldArray: () => PluginSettingsField[];
};

type CreateSettingsSchema = <T extends SettingsFieldDefs>(fields: T) => PluginSettingsSchemaInstance<T>;

export const createSettingsSchema: CreateSettingsSchema = (fields) => ({
  _fields: fields,
  toFieldArray: () =>
    Object.entries(fields).map(([name, def]) => ({ name, ...def }) as PluginSettingsField),
});
```

Add `system?` and `settingsSchema?` to `PluginDefinition`:

```typescript
export type PluginDefinition = {
  name: string;
  version: string;
  system?: boolean;  // elevates to system plugin — owner-controlled only (see Governance)
  register: RegisterFn;
  start?: StartFn;
  stop?: StopFn;
  tools?: PluginTool[];
  settingsSchema?: PluginSettingsSchemaInstance<SettingsFieldDefs>;
};
```

Add `onSettingsChange` to `PluginHooks`:

```typescript
export type PluginHooks = {
  // ...existing hooks...
  onSettingsChange?: (pluginName: string) => Promise<void>;
};
```

`onSettingsChange` is a notification hook. It receives `pluginName` so each plugin can check
whether the change is relevant to itself. The plugin calls `ctx.getSettings(schema)` inside
the handler to retrieve fresh typed values — the hook carries no data to avoid ambiguity
over whether values are encrypted or decrypted.

Add `getSettings` and `notifySettingsChange` to `PluginContext`:

```typescript
export type PluginContext = {
  db: PrismaClient;
  invoker: Invoker;
  config: OrchestratorConfig;
  logger: Logger;
  sendToThread: (threadId: string, content: string) => Promise<void>;
  broadcast: (event: string, data: unknown) => Promise<void>;
  getSettings: <T extends SettingsFieldDefs>(
    schema: PluginSettingsSchemaInstance<T>
  ) => Promise<InferSettings<T>>;
  notifySettingsChange: (pluginName: string) => Promise<void>;
};
```

`getSettings` is a closure bound to the plugin's own `name` at registration time — the plugin
cannot pass a different name. `notifySettingsChange` is constructed in the orchestrator as a
closure over `allHooks()` and `runNotifyHooks`, exactly like `broadcast` is today.

---

## Per-Plugin Context Construction (Orchestrator Change)

The orchestrator currently constructs one shared `PluginContext` and passes it to all plugins.
To support scoped `ctx.db` and per-plugin `ctx.getSettings`, `registerPlugin` must construct
a **derived context per plugin** and store it alongside the plugin's hooks for use in `start`
and `stop`.

```typescript
// In createOrchestrator, the plugins array gains a ctx field:
const plugins: Array<{
  definition: PluginDefinition;
  hooks: PluginHooks;
  ctx: PluginContext;
}> = [];

// registerPlugin builds a scoped context before calling register:
registerPlugin: async (definition: PluginDefinition) => {
  const pluginCtx = createPluginScopedContext(baseContext, definition, deps);
  const hooks = await definition.register(pluginCtx);
  plugins.push({ definition, hooks, ctx: pluginCtx });
},

// start/stop use the stored per-plugin ctx, not the shared base context:
start: async () => {
  for (const plugin of plugins) {
    if (plugin.definition.start) {
      await plugin.definition.start(plugin.ctx);
    }
  }
},
```

`createPluginScopedContext(baseCtx, definition, deps)` returns a new `PluginContext` that:

1. Wraps `deps.db` with a Prisma extension scoping `pluginConfig` reads/writes to
   `definition.name` (skipped for `definition.system === true`)
2. Adds `getSettings` as a closure capturing `definition.name`
3. Adds `notifySettingsChange` as a closure over `allHooks()` and `runNotifyHooks`
4. Passes all other fields through from `baseCtx` unchanged

This is a bounded change to `apps/orchestrator/src/orchestrator/index.ts` and a new
`_helpers/create-plugin-scoped-context.ts` helper with a corresponding test.

---

## Per-Plugin Schema Definition

Each plugin that requires configuration adds `src/_helpers/settings-schema.ts`:

```typescript
// packages/plugins/discord/src/_helpers/settings-schema.ts
import { createSettingsSchema } from "@harness/plugin-contract";

export const settingsSchema = createSettingsSchema({
  token:   { type: "password", label: "Bot Token",       required: true, secret: true },
  guildId: { type: "text",     label: "Guild ID",         required: true },
  prefix:  { type: "text",     label: "Command Prefix",   placeholder: "!" },
});
```

This file is **pure data**. No Node.js APIs. No React. No side effects. Zero dependencies
beyond the type import from `plugin-contract`. The plugin references it in its definition:

```typescript
// packages/plugins/discord/src/index.ts
import type { PluginContext, PluginDefinition, PluginHooks } from "@harness/plugin-contract";
import { settingsSchema } from "./_helpers/settings-schema";

type CreateRegister = () => PluginDefinition["register"];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info("Discord plugin registered");
    return {
      onSettingsChange: async (pluginName) => {
        if (pluginName !== "discord") return;
        const settings = await ctx.getSettings(settingsSchema);
        if (!settings.token) return;
        // reconnect client with new token
      },
    };
  };
  return register;
};

export const plugin: PluginDefinition = {
  name: "discord",
  version: "1.0.0",
  settingsSchema,
  register: createRegister(),
  start,
  stop,
};
```

---

## Discord Token Migration

The Discord plugin currently reads `ctx.config.discordToken` (from `DISCORD_TOKEN` env var).
Migrating to `ctx.getSettings(settingsSchema)` is a breaking change for existing deployments.

Migration path: in `start()`, check both sources and auto-migrate:

```typescript
const start: StartDiscordPlugin = async (ctx) => {
  const settings = await ctx.getSettings(settingsSchema);
  let token = settings.token;

  if (!token && ctx.config.discordToken) {
    ctx.logger.warn(
      "Discord: migrating token from DISCORD_TOKEN env var to DB settings. " +
      "Remove DISCORD_TOKEN from your environment after confirming the migration."
    );
    // Write env var token to DB settings for future reads
    await ctx.db.pluginConfig.update({
      where: { pluginName: "discord" },
      data: { settings: { token: ctx.config.discordToken } },
    });
    token = ctx.config.discordToken;
  }

  if (!token) {
    ctx.logger.warn("Discord: no token configured — skipping connection");
    return;
  }
  // connect with token
};
```

After one successful run the env var is redundant. The deprecation warning tells operators
when they can remove it. `discordToken` and `discordChannelId` remain in `OrchestratorConfig`
during the migration window and can be removed in a later cleanup.

---

## Code Generator

**Command:** `pnpm plugin:generate`
**Script:** `scripts/generate-plugin-registry.ts` (runs via `tsx`, already a devDependency in
`apps/orchestrator/package.json` — add to root `devDependencies` for shared tooling)
**Turborepo task:** declared in `apps/web/package.json` with cross-package file inputs:

```json
{
  "plugin:generate": {
    "inputs": ["../../packages/plugins/*/src/_helpers/settings-schema.ts"],
    "outputs": ["src/generated/plugin-settings-registry.ts"]
  }
}
```

Turbo re-runs the generator whenever any `settings-schema.ts` changes. In persistent dev mode
(`next dev`), the generator runs once at startup. Adding a new schema mid-session requires
running `pnpm plugin:generate` manually — same behavior as `prisma generate` after schema edits.

The generator:

1. Scans `packages/plugins/*/src/_helpers/settings-schema.ts` for existence
2. For each found, dynamically `import()`s the file at script runtime via `tsx`
3. Calls `.toFieldArray()` on the exported `settingsSchema` instance
4. Serializes the field array as a plain object literal in the output file

**Output:** `apps/web/src/generated/plugin-settings-registry.ts`

```typescript
// AUTO-GENERATED by scripts/generate-plugin-registry.ts
// Run `pnpm plugin:generate` to update. Do not edit manually.
import type { PluginSettingsField } from "@harness/plugin-contract";

export const PLUGIN_SETTINGS_REGISTRY: Record<string, PluginSettingsField[]> = {
  discord: [
    { name: "token",   type: "password", label: "Bot Token",       required: true, secret: true },
    { name: "guildId", type: "text",     label: "Guild ID",         required: true },
    { name: "prefix",  type: "text",     label: "Command Prefix",   placeholder: "!" },
  ],
};
```

No imports from plugin packages in the generated file. Only `plugin-contract` types. No
`transpilePackages` changes required per plugin. Turbopack sees only static imports.

**New plugin contributor flow:**

1. Create `packages/plugins/my-plugin/src/_helpers/settings-schema.ts`
2. Export `settingsSchema` using `createSettingsSchema`
3. Run `pnpm plugin:generate`
4. Settings UI appears at `/admin/plugins/my-plugin` automatically

---

## Encryption

**Env var:** `HARNESS_ENCRYPTION_KEY`
**Algorithm:** AES-256-GCM
**Scope:** Only fields with `secret: true` are encrypted
**Dev default:** Static key in `.env.example` (documented as insecure, dev-only)
**Production:** Key generated by setup script, stored in environment

Encryption and decryption are handled transparently inside:
- `savePluginSettings(pluginName, values)` — encrypts `secret: true` fields before DB write
- `getPluginSettings(db, pluginName, schema)` — decrypts `secret: true` fields after DB read

Plugins never see ciphertext. The UI never returns `secret: true` values to the browser —
fields render as empty password inputs (not populated with stored value). Agent tools
similarly never return `secret: true` field values.

---

## Plugin Isolation

### Regular plugins

`ctx.db` passed to regular plugins is wrapped with a **Prisma extension** that scopes all
`pluginConfig` operations to the plugin's own row:

- `findUnique` — throws if `where.pluginName` is not the plugin's own name
- `findMany` — forces `where: { pluginName: ownName }` regardless of caller's filter
- `update` / `upsert` — throws if attempting to write another plugin's config

`$queryRaw` and `$executeRaw` are **blocked entirely** for regular plugins. Any PR adding raw
SQL calls to a community plugin is rejected at review.

`ctx.getSettings(schema)` is the canonical way to read own settings. It internally uses the
scoped `ctx.db` — no isolation bypass.

### System plugins

`PluginDefinition.system: true` marks a plugin as system-level. System plugins receive an
unscoped `ctx.db` and are exempt from the `pluginConfig` Prisma extension.

**Governance rule:** `system: true` is reserved for first-party plugins maintained by the
project owner. PRs from external contributors adding `system: true` to any plugin definition
are closed without review. The current exhaustive list of system plugins:

- `settings-manager` *(planned)* — exposes agent tools for plugin configuration

New system plugins require explicit owner approval and are tracked in this list.

---

## Runtime Settings Reload

When a user saves plugin settings via the admin UI:

1. Server Action writes to `PluginConfig.settings` via Prisma (encrypts secret fields)
2. Server Action calls `POST /api/plugins/:name/reload` on the orchestrator (fire-and-forget)
3. Web plugin route handler calls `ctx.notifySettingsChange(pluginName)`
4. `notifySettingsChange` runs `onSettingsChange(pluginName)` through `runNotifyHooks` on
   all registered plugins — same runner as `onBroadcast`, `onPipelineStart`, etc.
5. Each plugin's `onSettingsChange` implementation checks whether `pluginName` matches its
   own name and returns early if not
6. The matching plugin calls `ctx.getSettings(schema)` to get fresh typed settings and
   reconnects or reinitializes as needed

If the orchestrator is unreachable during the reload call, settings are still saved to DB.
The plugin picks up new settings on next process start.

**Future upgrade path:** Replace HTTP callback with PostgreSQL `LISTEN/NOTIFY`. Orchestrator
subscribes to a `plugin_settings` channel; web Server Action emits `NOTIFY` after save.
Eliminates the web-to-orchestrator HTTP coupling.

---

## Admin UI

### Layout: VS Code-style

`/admin/plugins/layout.tsx` provides the split layout. It wraps:
- `admin/plugins/page.tsx` — existing plugin list table (becomes the right-side default view
  when no specific plugin is selected; the `PluginsTable` component stays as-is)
- `admin/plugins/[name]/page.tsx` — new settings detail for a specific plugin

The left nav lists all `PluginConfig` rows (plugin name + enabled/disabled badge). Active item
is highlighted. Clicking navigates to `/admin/plugins/[name]`.

### Detail page (`/admin/plugins/[name]`)

Server Component. On render:
1. Reads `PluginConfig` from DB via Prisma (enabled state + current settings)
2. Looks up `PLUGIN_SETTINGS_REGISTRY[name]` from the generated file
3. If no registry entry: renders "No configurable settings"
4. If plugin is disabled: form renders with all inputs disabled + banner:
   *"This plugin is disabled. Settings can be saved but will not take effect until the plugin
   is enabled."*

### Settings form

Client Component using existing shadcn/ui primitives. Field type → component mapping:

| Field type | Component |
|---|---|
| `text` | Input |
| `password` | Input type="password" |
| `textarea` | Textarea |
| `boolean` | Switch |
| `select` | Select |
| `number` | Input type="number" |

`secret: true` fields **never pre-populate** from stored values — always render as empty
password inputs.

**Advisory validation:** When `required: true` fields are empty, individual field borders turn
red and a warning banner appears at the top: *"This plugin may not function correctly —
required fields are highlighted."* The Save button remains enabled. Saving with missing
required fields is always allowed — `required` is advisory, not enforced.

### Save flow

```
User clicks Save
  → savePluginSettings(pluginName, values)  [Server Action]
    → Coerce values to correct primitives per field type
    → Encrypt fields where secret: true
    → db.pluginConfig.update({ settings: encryptedValues })
    → fetch POST /api/plugins/${pluginName}/reload  (fire-and-forget, not awaited)
    → revalidatePath(`/admin/plugins/${pluginName}`)
```

---

## Planned Future Work

**Agent-assisted setup (`settings-manager` system plugin)**
Claude can configure plugins via conversation: "set up Discord for me" → agent asks for token
→ calls `settings__save_setting` tool → `notifySettingsChange` fires → plugin reloads.
Requires the `settings-manager` system plugin with elevated DB access. Prerequisites: secret
field values must never be echoed back into conversation history; scrubbing strategy for user
messages containing secrets must be designed first.

**CDC-based reload notification**
Replace HTTP callback with Postgres `LISTEN/NOTIFY` for decoupled, orchestrator-side change
detection.

**CI enforcement of `$queryRaw` and `system: true` bans**
Automated checks in GitHub Actions that fail any PR introducing `$queryRaw` or `$executeRaw`
in plugin packages, or adding `system: true` to any plugin not on the approved list.

**VM isolation for plugins**
Running each plugin in a V8 isolate or worker thread. Deferred — Prisma extension scoping and
governance model is sufficient for current scale.

---

## Files to Create or Modify

| File | Action | Notes |
|------|--------|-------|
| `packages/plugin-contract/src/index.ts` | Modify | Add `createSettingsSchema`, `PluginSettingsField` (discriminated union), `PluginSettingsSchemaInstance`, `InferSettings`, `CreateSettingsSchema`; add `system?` and `settingsSchema?` to `PluginDefinition`; add `onSettingsChange` to `PluginHooks`; add `getSettings` and `notifySettingsChange` to `PluginContext` |
| `apps/orchestrator/src/orchestrator/index.ts` | Modify | Add `notifySettingsChange` to base context; change `plugins[]` to store per-plugin `ctx`; `registerPlugin`, `start`, `stop` use per-plugin context |
| `apps/orchestrator/src/orchestrator/_helpers/create-plugin-scoped-context.ts` | Create | Wraps db with Prisma extension, binds `getSettings` and `notifySettingsChange` closures |
| `apps/orchestrator/src/orchestrator/_helpers/__tests__/create-plugin-scoped-context.test.ts` | Create | Tests for scoping behavior and isolation |
| `packages/plugins/discord/src/_helpers/settings-schema.ts` | Create | Discord schema (token, guildId, prefix) — first schema as reference implementation |
| `packages/plugins/discord/src/index.ts` | Modify | Add `settingsSchema`, `onSettingsChange` hook, migrate from `ctx.config.discordToken` to `ctx.getSettings(settingsSchema)` |
| `packages/plugins/web/src/_helpers/routes.ts` | Modify | Add `POST /api/plugins/:name/reload` route — calls `ctx.notifySettingsChange(name)` |
| `scripts/generate-plugin-registry.ts` | Create | Code generator — scans `_helpers/settings-schema.ts` files, calls `toFieldArray()`, serializes to generated registry |
| `scripts/__tests__/generate-plugin-registry.test.ts` | Create | Tests for generator discovery and output correctness |
| `package.json` (root) | Modify | Add `plugin:generate` script; add `tsx` to `devDependencies` |
| `apps/web/package.json` | Modify | Add `plugin:generate` Turborepo task with cross-package `inputs` glob |
| `apps/web/src/generated/plugin-settings-registry.ts` | Generated | Do not edit manually — output of `pnpm plugin:generate` |
| `apps/web/src/app/admin/plugins/layout.tsx` | Create | Split layout — left nav + outlet; wraps existing `page.tsx` as default right-side content |
| `apps/web/src/app/admin/plugins/[name]/page.tsx` | Create | Settings detail — Server Component; reads DB + generated registry |
| `apps/web/src/app/admin/plugins/[name]/_components/settings-form.tsx` | Create | Schema-driven form — Client Component |
| `apps/web/src/app/admin/plugins/[name]/_actions/save-plugin-settings.ts` | Create | Server Action — validate, encrypt, write, reload, revalidatePath |
| Coverage gate config | Modify | Add `**/settings-schema.ts` to exclusions (pure data, no branches to cover) |
