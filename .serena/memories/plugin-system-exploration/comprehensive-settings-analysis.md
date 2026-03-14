# Plugin System Settings & Configuration Analysis

## Complete Plugin Settings & Configuration Surface

### 1. PluginDefinition Shape (plugin-contract/src/index.ts:171-182)

```typescript
type PluginDefinition = {
  name: string;
  version: string;
  register: (ctx: PluginContext) => Promise<PluginHooks>;
  start?: (ctx: PluginContext) => Promise<void>;
  stop?: (ctx: PluginContext) => Promise<void>;
  tools?: PluginTool[];
  system?: boolean;
  settingsSchema?: PluginSettingsSchemaInstance<SettingsFieldDefs>;
};
```

- `register` is the ONLY required property
- `start/stop` optional lifecycle — called before/after plugin operation
- `tools` optional array of MCP tools exposed to Claude
- `system` optional boolean — if true, receives unsandboxed PluginContext (no DB sandboxing)
- `settingsSchema` optional typed settings definition for admin UI code generation

### 2. Settings Schema Types (plugin-contract/src/index.ts:77-118)

**Field types:** `'string' | 'number' | 'boolean' | 'select'`

```typescript
type PluginSettingsField = {
  type: SettingsFieldType;
  label: string;
  description?: string;
  required?: boolean;
  secret?: boolean; // encrypted at rest
  default?: string | number | boolean;
  options?: { label: string; value: string }[]; // for select type
  name: string; // added by createSettingsSchema
};

type SettingsFieldDefs = Record<string, Omit<PluginSettingsField, 'name'>>;

// Create schema
export const createSettingsSchema = <T extends SettingsFieldDefs>(fields: T) => ({
  toFieldArray: () => Object.entries(fields).map(([name, def]) => ({ name, ...def }))
});

// Type inference
type InferSettings<T extends SettingsFieldDefs> = {
  [K in keyof T]?: InferFieldValue<T[K]>;
};
```

### 3. PluginContext API (plugin-contract/src/index.ts:120-130)

```typescript
type PluginContext = {
  db: PrismaClient;
  invoker: Invoker;
  config: OrchestratorConfig;
  logger: Logger;
  sendToThread: (threadId: string, content: string) => Promise<void>;
  broadcast: (event: string, data: unknown) => Promise<void>;
  getSettings: <T extends SettingsFieldDefs>(schema: PluginSettingsSchemaInstance<T>) => Promise<InferSettings<T>>;
  notifySettingsChange: (pluginName: string) => Promise<void>;
  setActiveTaskId?: (taskId: string | undefined) => void;
};
```

**Key properties for settings:**
- `getSettings` — read typed plugin settings from `PluginConfig` DB records
- `notifySettingsChange` — trigger `onSettingsChange` hooks for all plugins (hot-reload)

### 4. PluginConfig Database Model (packages/database/prisma/schema.prisma:148-157)

```prisma
model PluginConfig {
  id         String   @id @default(cuid())
  pluginName String   @unique
  enabled    Boolean  @default(true)
  settings   Json?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([pluginName])
}
```

- One record per plugin
- `enabled` flag: runtime toggle without code changes
- `settings` JSON field: stores encrypted secrets + user config
- Unique constraint on `pluginName` ensures single config per plugin

### 5. Get Settings Flow (orchestrator/src/orchestrator/_helpers/get-plugin-settings.ts)

1. Looks up `PluginConfig` by `pluginName`
2. Reads `settings` JSON field
3. For each field marked `secret: true`:
   - Attempts decryption with `HARNESS_ENCRYPTION_KEY`
   - Falls back to plaintext if decryption fails (pre-migration data)
4. Returns typed result matching schema

**No null coalescing:** plugins must check `settings.field === undefined`

### 6. Encryption (plugin-contract/src/_helpers/encrypt-value.ts & decrypt-value.ts)

- Admin UI encrypts secret fields before saving: `encryptValue(value, encryptionKey)`
- Orchestrator decrypts on read: `decryptValue(value, encryptionKey)`
- Empty secret fields in form = skip update, preserve existing encrypted value
- Key: `process.env.HARNESS_ENCRYPTION_KEY`

### 7. Admin UI Flow (apps/web/src/app/admin/plugins/...)

**Plugin list page:**
- `/admin/plugins` — lists all `PluginConfig` records
- Toggle button: calls `togglePlugin` server action
- Links to `/admin/plugins/[name]` for settings

**Plugin detail page:**
- `/admin/plugins/[name]` — show enabled status + settings form
- Form uses generated registry: `pluginSettingsRegistry` (from `pnpm plugin:generate`)
- Submit calls `savePluginSettings` server action:
  1. Build payload from form data: `buildSettingsPayload(fields, formData, encryptionKey)`
  2. Merge with existing (preserves encrypted secrets): `{ ...existingSettings, ...newSettings }`
  3. `prisma.pluginConfig.upsert` — create if missing, update if exists
  4. POST to `/api/plugins/{pluginName}/reload` (non-blocking, orchestrator may be down)
  5. `revalidatePath` to refresh form

**Toggle plugin action:**
- `togglePlugin` server action: flips `enabled` boolean
- Does NOT reload settings (just a flag change)
- Does NOT notify orchestrator

### 8. Settings Code Generation (scripts/generate-plugin-registry.ts)

Runs via `pnpm plugin:generate`:

1. Scans all `packages/plugins/*/src/_helpers/settings-schema.ts` files
2. Imports each schema and calls `toFieldArray()`
3. Generates `apps/web/src/generated/plugin-settings-registry.ts` — auto-imported by admin forms

**Important:** Only settings WITH a `settingsSchema` export are included. Plugins without settings are silently skipped.

### 9. Hot-Reload Flow (orchestrator → plugins)

**Trigger sources:**
1. Admin UI form submit → `POST /api/plugins/{pluginName}/reload` from `save-plugin-settings`
2. MCP tool call → `void ctx.notifySettingsChange(pluginName)` (fire-and-forget)
3. Manual via browser → same `/api/plugins/{pluginName}/reload` endpoint

**Orchestrator side:**
- HTTP POST handler → calls `ctx.notifySettingsChange(pluginName)`
- This fires all `onSettingsChange` hooks with the plugin name
- Each plugin's `onSettingsChange` hook re-reads its settings: `ctx.getSettings(schema)`

**Live examples:**
- Discord plugin: `onSettingsChange` → reconnect with new bot token
- Cron plugin: `onSettingsChange` → stop all jobs, re-query DB, restart scheduler
- Delegation plugin: `onSettingsChange` → reload max iterations, cost cap

### 10. Persistence & Sandboxing

**DB sandboxing (non-system plugins):**
- `buildPluginContext` wraps `ctx.db` with `createScopedDb(db, pluginName)`
- Scoped DB filters all read queries: `where: { _pluginScope: pluginName }`
- Schema requirement: Every table with multi-plugin data needs `_pluginScope` index
- Currently: No tables have `_pluginScope` — all plugins see all records

**System plugins (system: true):**
- Receive unsandboxed PluginContext — access to all DB tables
- Example: None currently (all 14 plugins are non-system)

### 11. MCP Tool Metadata & Context (plugin-contract/src/index.ts:152-165)

```typescript
type PluginToolMeta = {
  threadId: string;
  taskId?: string; // set by delegation plugin's setActiveTaskId
  traceId?: string; // trace ID for correlating with pipeline run
};

type PluginToolHandler = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

type PluginTool = {
  name: string;
  description: string;
  schema: Record<string, unknown>; // JSON Schema for input validation
  handler: PluginToolHandler;
};
```

**Tool qualification:** `pluginName__toolName` (e.g., `delegation__delegate`)

**Handler context:**
- `meta.threadId` — always populated (current conversation thread)
- `meta.taskId` — populated only if running within a delegation task
- `meta.traceId` — trace correlation with originating pipeline run

### 12. Task Hooks Lifecycle (OrchestratorTask model)

```prisma
model OrchestratorTask {
  id               String
  threadId         String
  status           String @default("pending")
  prompt           String
  result           String?
  maxIterations    Int @default(3)
  currentIteration Int @default(0)
  agentRuns        AgentRun[]
}
```

**Hooks fired during delegation:**
- `onTaskCreate` — after task record created, before sub-agent invoked
- `onTaskComplete` — after sub-agent response validated
- `onTaskFailed` — after max iterations exhausted

**Hook signatures:**
```typescript
onTaskCreate?: (threadId: string, taskId: string) => Promise<void>;
onTaskComplete?: (threadId: string, taskId: string, result: string) => Promise<void>;
onTaskFailed?: (threadId: string, taskId: string, error: Error) => Promise<void>;
```

**Current plugin implementing task hooks:**
- Validator plugin: `onTaskComplete` — runs rubric validation, can throw to reject

### 13. Plugin Settings Examples in Codebase

**Discord plugin:**
```typescript
botToken: { type: 'string', label: 'Bot Token', secret: true, required: true }
```

**Cron plugin:**
```typescript
timezone: { type: 'string', label: 'Timezone', default: 'UTC' }
```

**Context plugin:**
```typescript
historyLimit: { type: 'number', default: 50 }
historyLimitWithSummary: { type: 'number', default: 25 }
summaryLookback: { type: 'number', default: 2 }
```

**Validator plugin:**
```typescript
customRubric: { type: 'string', label: 'Custom Validation Rubric', description: '...' }
```

**Summarization plugin:**
```typescript
triggerCount: { type: 'number', default: 50 }
duplicateGuardSeconds: { type: 'number', default: 60 }
customPrompt: { type: 'string' }
```

### 14. Key Architectural Constraints

1. **No system plugins yet** — all 14 plugins are non-system, but infrastructure is ready
2. **No DB scoping yet** — all plugins see all records; scoping framework exists but unused
3. **Hot-reload is partial** — settings are live, but some plugins cache values at startup
4. **Settings are JSON** — no structured multi-level config yet (could be added)
5. **Admin UI is generated** — `pnpm plugin:generate` creates form registry from schemas
6. **Encryption is optional** — only `secret: true` fields are encrypted
7. **Task hooks are wired** — but only validator plugin implements `onTaskComplete`

## Extensibility Checklist for Agent-Malleable Plugins

✅ Plugins can have typed settings (schema-based)
✅ Settings are persisted to DB per plugin
✅ Settings can be changed at runtime without code
✅ Plugins are notified of settings changes via `onSettingsChange`
✅ Plugins can expose MCP tools for Claude to call
✅ Task lifecycle hooks exist (`onTaskCreate`, `onTaskComplete`, `onTaskFailed`)
✅ Tool metadata includes thread/task context
✅ Encryption support for secret fields
✅ Plugin can be enabled/disabled at runtime
✅ Admin UI auto-generated from schemas

❌ No per-plugin permission scoping (all plugins see all records)
❌ No multi-level config (flat JSON object)
❌ No settings version history or rollback
❌ No audit trail for settings changes
❌ No settings validation beyond JSON schema
