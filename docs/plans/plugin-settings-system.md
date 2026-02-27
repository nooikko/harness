# Plugin Settings System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow plugins to declare typed settings schemas co-located with their code, driving auto-generated admin UI with AES-256-GCM encryption at rest for secrets, live reload on save, and complete per-plugin DB isolation.

**Architecture:** `createSettingsSchema()` factory in `@harness/plugin-contract` defines typed field schemas → a code-generation script (`pnpm plugin:generate`) scans plugin packages and embeds schema data into `apps/web/src/generated/plugin-settings-registry.ts` (no runtime plugin imports in the output) → the orchestrator creates per-plugin `PluginContext` objects with scoped `ctx.db` (Prisma `$extends` forces every `pluginConfig` query to the plugin's own row) and a `ctx.getSettings(schema)` closure that decrypts secret fields → a VS Code-style admin UI at `/admin/plugins/[name]` renders forms from the registry and saves via Server Action + orchestrator reload HTTP call.

**Tech Stack:** TypeScript, Node.js `node:crypto` (AES-256-GCM), Prisma `$extends` for query scoping, Next.js 16 App Router + Server Actions + `useActionState`, tsx (already in orchestrator devDeps), glob (new root devDep), Turborepo cross-package task inputs.

---

## Task 1: Settings schema types and `createSettingsSchema` in plugin-contract

**Files:**
- Modify: `packages/plugin-contract/src/index.ts`
- Test: `packages/plugin-contract/src/__tests__/index.test.ts` (add to existing)

**Step 1: Write the failing tests**

Add to `packages/plugin-contract/src/__tests__/index.test.ts`:

```typescript
import { createSettingsSchema } from '../index';

describe('createSettingsSchema', () => {
  it('toFieldArray returns entries with name prepended', () => {
    const schema = createSettingsSchema({
      botToken: { type: 'string' as const, label: 'Bot Token', secret: true, required: true },
      channelId: { type: 'string' as const, label: 'Channel ID' },
    });

    const fields = schema.toFieldArray();
    expect(fields).toHaveLength(2);
    expect(fields[0]).toEqual({ name: 'botToken', type: 'string', label: 'Bot Token', secret: true, required: true });
    expect(fields[1]).toEqual({ name: 'channelId', type: 'string', label: 'Channel ID' });
  });

  it('handles select type with options', () => {
    const schema = createSettingsSchema({
      mode: {
        type: 'select' as const,
        label: 'Mode',
        options: [{ label: 'Production', value: 'prod' }],
      },
    });
    const fields = schema.toFieldArray();
    expect(fields[0]).toMatchObject({
      name: 'mode',
      type: 'select',
      options: expect.arrayContaining([{ label: 'Production', value: 'prod' }]),
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @harness/plugin-contract test
```
Expected: FAIL with `createSettingsSchema is not a function`

**Step 3: Add types and createSettingsSchema to plugin-contract**

Add to `packages/plugin-contract/src/index.ts` after the `PluginDefinition` type block:

```typescript
// --- Plugin Settings ---

export type SettingsFieldType = 'string' | 'number' | 'boolean' | 'select';

type SettingsFieldBase = {
  type: SettingsFieldType;
  label: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
  default?: string | number | boolean;
};

type SettingsFieldScalar = SettingsFieldBase & { type: Exclude<SettingsFieldType, 'select'> };
type SettingsFieldSelect = SettingsFieldBase & {
  type: 'select';
  options: { label: string; value: string }[];
};

export type PluginSettingsField = (SettingsFieldScalar | SettingsFieldSelect) & { name: string };

export type SettingsFieldDefs = Record<string, Omit<PluginSettingsField, 'name'>>;

type InferFieldValue<F extends Omit<PluginSettingsField, 'name'>> =
  F['type'] extends 'boolean' ? boolean :
  F['type'] extends 'number'  ? number  :
  string;

export type InferSettings<T extends SettingsFieldDefs> = {
  [K in keyof T]?: InferFieldValue<T[K]>;
};

export type PluginSettingsSchemaInstance<T extends SettingsFieldDefs> = {
  toFieldArray: () => PluginSettingsField[];
};

type CreateSettingsSchema = <T extends SettingsFieldDefs>(fields: T) => PluginSettingsSchemaInstance<T>;

export const createSettingsSchema: CreateSettingsSchema = (fields) => ({
  toFieldArray: () =>
    Object.entries(fields).map(([name, def]) => ({ name, ...def }) as PluginSettingsField),
});
```

Also update `PluginHooks` — add `onSettingsChange?`:
```typescript
onSettingsChange?: (pluginName: string) => Promise<void>;
```

Also update `PluginContext` — add `getSettings` and `notifySettingsChange`:
```typescript
getSettings: <T extends SettingsFieldDefs>(schema: PluginSettingsSchemaInstance<T>) => Promise<InferSettings<T>>;
notifySettingsChange: (pluginName: string) => Promise<void>;
```

Also update `PluginDefinition` — add optional fields:
```typescript
system?: boolean;
settingsSchema?: PluginSettingsSchemaInstance<SettingsFieldDefs>;
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @harness/plugin-contract test
```
Expected: PASS

**Step 5: Run typecheck**

```bash
pnpm --filter @harness/plugin-contract typecheck
```
Expected: PASS (the new types must not break existing type system)

**Step 6: Commit**

```bash
git add packages/plugin-contract/src/index.ts packages/plugin-contract/src/__tests__/index.test.ts
git commit -m "feat(plugin-contract): add createSettingsSchema, settings types, and onSettingsChange hook"
```

---

## Task 2: AES-256-GCM encryption helpers in plugin-contract

**Files:**
- Create: `packages/plugin-contract/src/_helpers/encrypt-value.ts`
- Create: `packages/plugin-contract/src/_helpers/decrypt-value.ts`
- Create: `packages/plugin-contract/src/_helpers/__tests__/encrypt-value.test.ts`
- Create: `packages/plugin-contract/src/_helpers/__tests__/decrypt-value.test.ts`
- Modify: `packages/plugin-contract/src/index.ts` (re-export)

**Step 1: Write the failing tests**

```typescript
// packages/plugin-contract/src/_helpers/__tests__/encrypt-value.test.ts
import { describe, expect, it } from 'vitest';
import { encryptValue } from '../encrypt-value';

const TEST_KEY = 'a'.repeat(64); // 32 bytes as 64 hex chars

describe('encryptValue', () => {
  it('returns iv:tag:ciphertext format (3 colon-separated hex parts)', () => {
    const result = encryptValue('hello', TEST_KEY);
    const parts = result.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24); // 12-byte IV → 24 hex chars
    expect(parts[1]).toHaveLength(32); // 16-byte GCM tag → 32 hex chars
    expect(parts[2]!.length).toBeGreaterThan(0);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const a = encryptValue('hello', TEST_KEY);
    const b = encryptValue('hello', TEST_KEY);
    expect(a).not.toBe(b);
  });

  it('throws if key is wrong length', () => {
    expect(() => encryptValue('hello', 'tooshort')).toThrow('hex characters');
  });
});
```

```typescript
// packages/plugin-contract/src/_helpers/__tests__/decrypt-value.test.ts
import { describe, expect, it } from 'vitest';
import { decryptValue } from '../decrypt-value';
import { encryptValue } from '../encrypt-value';

const TEST_KEY = 'a'.repeat(64);

describe('decryptValue', () => {
  it('round-trips plaintext correctly', () => {
    const plaintext = 'my-secret-bot-token-xyz';
    const encrypted = encryptValue(plaintext, TEST_KEY);
    expect(decryptValue(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encryptValue('hello', TEST_KEY);
    const parts = encrypted.split(':');
    const tampered = `${parts[0]}:${parts[1]}:deadbeef`;
    expect(() => decryptValue(tampered, TEST_KEY)).toThrow();
  });

  it('throws on malformed format (not 3 parts)', () => {
    expect(() => decryptValue('only:two', TEST_KEY)).toThrow('Invalid ciphertext format');
  });

  it('throws if key is wrong length', () => {
    expect(() => decryptValue('a:b:c', 'tooshort')).toThrow('hex characters');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm --filter @harness/plugin-contract test
```
Expected: FAIL with `Cannot find module '../encrypt-value'`

**Step 3: Implement encrypt-value.ts**

```typescript
// packages/plugin-contract/src/_helpers/encrypt-value.ts
import { createCipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;

type EncryptValue = (plaintext: string, key: string) => string;

export const encryptValue: EncryptValue = (plaintext, key) => {
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH * 2} hex characters`);
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};
```

**Step 4: Implement decrypt-value.ts**

```typescript
// packages/plugin-contract/src/_helpers/decrypt-value.ts
import { createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;

type DecryptValue = (ciphertext: string, key: string) => string;

export const decryptValue: DecryptValue = (ciphertext, key) => {
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH * 2} hex characters`);
  }
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }
  const [ivHex, tagHex, encryptedHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
};
```

**Step 5: Re-export from index.ts**

Add to `packages/plugin-contract/src/index.ts` (after existing re-exports at the top):
```typescript
export { encryptValue } from './_helpers/encrypt-value';
export { decryptValue } from './_helpers/decrypt-value';
```

**Step 6: Run tests to verify they pass**

```bash
pnpm --filter @harness/plugin-contract test
```
Expected: PASS

**Step 7: Commit**

```bash
git add packages/plugin-contract/src/_helpers/encrypt-value.ts \
        packages/plugin-contract/src/_helpers/decrypt-value.ts \
        packages/plugin-contract/src/_helpers/__tests__/encrypt-value.test.ts \
        packages/plugin-contract/src/_helpers/__tests__/decrypt-value.test.ts \
        packages/plugin-contract/src/index.ts
git commit -m "feat(plugin-contract): add AES-256-GCM encryptValue and decryptValue helpers"
```

---

## Task 3: createScopedDb — Prisma extension for per-plugin DB isolation

**Files:**
- Create: `apps/orchestrator/src/orchestrator/_helpers/create-scoped-db.ts`
- Create: `apps/orchestrator/src/orchestrator/_helpers/__tests__/create-scoped-db.test.ts`

**Background:** `createScopedDb(db, 'discord')` returns a Prisma extended client where every `pluginConfig` query has `pluginName` automatically injected into the `where`, `create`, etc. clauses. This prevents one plugin from accidentally reading or writing another plugin's config row.

**Step 1: Write the failing test**

```typescript
// apps/orchestrator/src/orchestrator/_helpers/__tests__/create-scoped-db.test.ts
import type { PrismaClient } from 'database';
import { describe, expect, it, vi } from 'vitest';
import { createScopedDb } from '../create-scoped-db';

describe('createScopedDb', () => {
  it('calls db.$extends and returns the result', () => {
    const extendedDb = { pluginConfig: { findUnique: vi.fn() } };
    const mockDb = {
      $extends: vi.fn().mockReturnValue(extendedDb),
    } as unknown as PrismaClient;

    const result = createScopedDb(mockDb, 'discord');

    expect(mockDb.$extends).toHaveBeenCalledOnce();
    expect(result).toBe(extendedDb);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter orchestrator test
```
Expected: FAIL with `Cannot find module '../create-scoped-db'`

**Step 3: Implement create-scoped-db.ts**

```typescript
// apps/orchestrator/src/orchestrator/_helpers/create-scoped-db.ts
import type { PrismaClient } from 'database';

type CreateScopedDb = (db: PrismaClient, pluginName: string) => PrismaClient;

export const createScopedDb: CreateScopedDb = (db, pluginName) => {
  return db.$extends({
    query: {
      pluginConfig: {
        async findUnique({ args, query }) {
          return query({ ...args, where: { ...args.where, pluginName } });
        },
        async upsert({ args, query }) {
          return query({
            ...args,
            where: { ...args.where, pluginName },
            create: { ...args.create, pluginName },
            update: args.update,
          });
        },
        async update({ args, query }) {
          return query({ ...args, where: { ...args.where, pluginName } });
        },
      },
    },
  }) as unknown as PrismaClient;
};
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter orchestrator test
```
Expected: PASS

**Step 5: Commit**

```bash
git add apps/orchestrator/src/orchestrator/_helpers/create-scoped-db.ts \
        apps/orchestrator/src/orchestrator/_helpers/__tests__/create-scoped-db.test.ts
git commit -m "feat(orchestrator): add createScopedDb Prisma extension for per-plugin isolation"
```

---

## Task 4: getPluginSettings — decrypt and type settings from DB

**Files:**
- Create: `apps/orchestrator/src/orchestrator/_helpers/get-plugin-settings.ts`
- Create: `apps/orchestrator/src/orchestrator/_helpers/__tests__/get-plugin-settings.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/orchestrator/src/orchestrator/_helpers/__tests__/get-plugin-settings.test.ts
import type { PrismaClient } from 'database';
import { describe, expect, it, vi } from 'vitest';
import { createSettingsSchema } from '@harness/plugin-contract';
import { getPluginSettings } from '../get-plugin-settings';

const schema = createSettingsSchema({
  botToken: { type: 'string' as const, label: 'Bot Token', secret: true },
  channelId: { type: 'string' as const, label: 'Channel ID' },
});

describe('getPluginSettings', () => {
  it('returns plaintext settings from DB', async () => {
    const mockDb = {
      pluginConfig: {
        findUnique: vi.fn().mockResolvedValue({
          pluginName: 'discord',
          settings: { botToken: 'plain-token', channelId: 'C123' },
          enabled: true,
        }),
      },
    } as unknown as PrismaClient;

    const settings = await getPluginSettings(mockDb, 'discord', schema);
    expect(settings.channelId).toBe('C123');
  });

  it('returns empty object when no config row exists', async () => {
    const mockDb = {
      pluginConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;

    const settings = await getPluginSettings(mockDb, 'discord', schema);
    expect(settings).toEqual({});
  });

  it('skips fields with null/undefined values', async () => {
    const mockDb = {
      pluginConfig: {
        findUnique: vi.fn().mockResolvedValue({ settings: { channelId: 'C123' } }),
      },
    } as unknown as PrismaClient;

    const settings = await getPluginSettings(mockDb, 'discord', schema);
    expect(settings.channelId).toBe('C123');
    expect(settings.botToken).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter orchestrator test
```
Expected: FAIL with `Cannot find module '../get-plugin-settings'`

**Step 3: Implement get-plugin-settings.ts**

```typescript
// apps/orchestrator/src/orchestrator/_helpers/get-plugin-settings.ts
import type { PrismaClient } from 'database';
import type {
  InferSettings,
  PluginSettingsSchemaInstance,
  SettingsFieldDefs,
} from '@harness/plugin-contract';
import { decryptValue } from '@harness/plugin-contract';

const ENCRYPTION_KEY = process.env['HARNESS_ENCRYPTION_KEY'] ?? '';

type GetPluginSettings = <T extends SettingsFieldDefs>(
  db: PrismaClient,
  pluginName: string,
  schema: PluginSettingsSchemaInstance<T>,
) => Promise<InferSettings<T>>;

export const getPluginSettings: GetPluginSettings = async (db, pluginName, schema) => {
  const config = await db.pluginConfig.findUnique({ where: { pluginName } });
  if (!config?.settings || typeof config.settings !== 'object') {
    return {} as InferSettings<typeof schema extends PluginSettingsSchemaInstance<infer T> ? T : never>;
  }

  const raw = config.settings as Record<string, unknown>;
  const fields = schema.toFieldArray();
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const value = raw[field.name];
    if (value === undefined || value === null) continue;

    if (field.secret && ENCRYPTION_KEY && typeof value === 'string' && value.includes(':')) {
      try {
        result[field.name] = decryptValue(value, ENCRYPTION_KEY);
      } catch {
        result[field.name] = value; // return as-is if decryption fails (pre-migration plaintext)
      }
    } else {
      result[field.name] = value;
    }
  }

  return result as InferSettings<typeof schema extends PluginSettingsSchemaInstance<infer T> ? T : never>;
};
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter orchestrator test
```
Expected: PASS

**Step 5: Commit**

```bash
git add apps/orchestrator/src/orchestrator/_helpers/get-plugin-settings.ts \
        apps/orchestrator/src/orchestrator/_helpers/__tests__/get-plugin-settings.test.ts
git commit -m "feat(orchestrator): add getPluginSettings helper with transparent decryption"
```

---

## Task 5: Wire per-plugin contexts in orchestrator

**Files:**
- Modify: `apps/orchestrator/src/orchestrator/index.ts`
- Modify: `apps/orchestrator/src/orchestrator/__tests__/index.test.ts`

**Background:** Currently `createOrchestrator` builds ONE shared `context: PluginContext` and passes it to every plugin's `register`, `start`, and `stop`. After this task:
- `plugins[]` stores `{ definition, hooks, ctx }` — per-plugin context alongside hooks
- `registerPlugin` builds a per-plugin context before calling `definition.register(pluginCtx)`
- `start`/`stop` loops use `plugin.ctx` instead of the shared `context`
- Non-system plugins get scoped `db` via `createScopedDb` and a real `getSettings` closure
- System plugins (`definition.system === true`) get the unscoped `db` (e.g., web plugin needs cross-plugin config access)
- `notifySettingsChange` lives on the shared base context — it fans out `onSettingsChange` to all plugins

The `runNotifyHooks` helper (at `_helpers/run-notify-hooks.ts`) has this call signature:
```typescript
runNotifyHooks(allHooks: PluginHooks[], hookName: string, callHook: (h: PluginHooks) => Promise<void> | undefined, logger: Logger)
```
Use this same pattern for `onSettingsChange`.

**Step 1: Understand the current test that will break**

In `apps/orchestrator/src/orchestrator/__tests__/index.test.ts`, lines 104-120:
- Line 114 asserts `expect(passedContext).toHaveProperty('db', deps.db)` — this will fail for non-system plugins since their `db` will be the scoped wrapper, not `deps.db` directly
- The `makeDeps().db` mock has no `$extends` method — calling `createScopedDb(deps.db, name)` will throw

Both issues must be fixed before implementing the feature.

**Step 2: Update the test file**

Changes in `apps/orchestrator/src/orchestrator/__tests__/index.test.ts`:

1. Add `$extends` to the db mock inside `makeDeps`:
```typescript
// In makeDeps, update db mock to include $extends:
db: {
  $extends: vi.fn().mockImplementation(() => ({
    // minimal scoped db stub — extends the mock
    pluginConfig: { findUnique: vi.fn().mockResolvedValue(null) },
  })),
  message: { create: vi.fn().mockResolvedValue({}) },
  thread: {
    findUnique: vi.fn().mockResolvedValue({ sessionId: null, model: null, kind: 'primary', name: 'Main' }),
    update: vi.fn().mockResolvedValue({}),
  },
  pluginConfig: { findUnique: vi.fn().mockResolvedValue(null) },
} as unknown as PrismaClient,
```

2. Replace the existing `'calls definition.register with the plugin context'` test (lines 104-120) with:
```typescript
it('calls definition.register with a per-plugin context containing required fields', async () => {
  const deps = makeDeps();
  const orchestrator = createOrchestrator(deps);
  const definition = makePluginDefinition('test-plugin');

  await orchestrator.registerPlugin(definition);

  expect(definition.register).toHaveBeenCalledTimes(1);
  const passedContext = (definition.register as ReturnType<typeof vi.fn>).mock.calls[0]![0] as PluginContext;
  // Non-system plugins receive a scoped db (not deps.db directly)
  expect(passedContext.db).toBeDefined();
  expect(passedContext).toHaveProperty('invoker', deps.invoker);
  expect(passedContext).toHaveProperty('config', deps.config);
  expect(passedContext).toHaveProperty('logger', deps.logger);
  expect(typeof passedContext.sendToThread).toBe('function');
  expect(typeof passedContext.broadcast).toBe('function');
  expect(typeof passedContext.getSettings).toBe('function');
  expect(typeof passedContext.notifySettingsChange).toBe('function');
});
```

3. Add a new test for system plugins:
```typescript
it('passes unscoped db to system plugins', async () => {
  const deps = makeDeps();
  const orchestrator = createOrchestrator(deps);
  const definition = makePluginDefinition('system-plugin', {}, { system: true });

  await orchestrator.registerPlugin(definition);

  const passedContext = (definition.register as ReturnType<typeof vi.fn>).mock.calls[0]![0] as PluginContext;
  expect(passedContext.db).toBe(deps.db);
});
```

**Step 3: Run tests to verify the new tests fail**

```bash
pnpm --filter orchestrator test
```
Expected: newly added assertions fail (TypeScript errors on missing `getSettings`/`notifySettingsChange`, and `$extends` missing from mock)

**Step 4: Update orchestrator/index.ts**

1. Add imports:
```typescript
import { createScopedDb } from './_helpers/create-scoped-db';
import { getPluginSettings } from './_helpers/get-plugin-settings';
import type { PluginSettingsSchemaInstance, SettingsFieldDefs } from '@harness/plugin-contract';
```

2. Update `plugins[]` type:
```typescript
const plugins: Array<{ definition: PluginDefinition; hooks: PluginHooks; ctx: PluginContext }> = [];
```

3. Add `notifySettingsChange` and a stub `getSettings` to the shared `context` object (after `broadcast`):
```typescript
notifySettingsChange: async (pluginName: string) => {
  await runNotifyHooks(allHooks(), 'onSettingsChange', (h) => h.onSettingsChange?.(pluginName), deps.logger);
},
getSettings: async () => {
  // Stub on base context — per-plugin contexts override this with the real implementation
  return {};
},
```

4. Add `buildPluginContext` helper inside `createOrchestrator` (after `context` is defined):
```typescript
const buildPluginContext = (definition: PluginDefinition): PluginContext => {
  if (definition.system) {
    return context; // system plugins get the full unscoped context
  }
  return {
    ...context,
    db: createScopedDb(deps.db, definition.name),
    getSettings: async <T extends SettingsFieldDefs>(schema: PluginSettingsSchemaInstance<T>) =>
      getPluginSettings(deps.db, definition.name, schema),
  };
};
```

5. Update `registerPlugin` to use per-plugin context and store `ctx`:
```typescript
registerPlugin: async (definition: PluginDefinition) => {
  const ctx = buildPluginContext(definition);
  const hooks = await definition.register(ctx);
  plugins.push({ definition, hooks, ctx });
  deps.logger.info(`Plugin registered: ${definition.name}@${definition.version}`);
},
```

6. Update `start` to use `plugin.ctx`:
```typescript
start: async () => {
  for (const plugin of plugins) {
    if (plugin.definition.start) {
      await plugin.definition.start(plugin.ctx);
    }
  }
  deps.logger.info('Orchestrator started');
},
```

7. Update `stop` to use `plugin.ctx`:
```typescript
stop: async () => {
  for (const plugin of plugins) {
    if (plugin.definition.stop) {
      await plugin.definition.stop(plugin.ctx);
    }
  }
  deps.logger.info('Orchestrator stopped');
},
```

**Step 5: Run tests to verify they pass**

```bash
pnpm --filter orchestrator test
```
Expected: PASS

**Step 6: Run typecheck**

```bash
pnpm --filter orchestrator typecheck
```
Expected: PASS

**Step 7: Commit**

```bash
git add apps/orchestrator/src/orchestrator/index.ts \
        apps/orchestrator/src/orchestrator/__tests__/index.test.ts
git commit -m "feat(orchestrator): wire per-plugin contexts with scoped DB, getSettings, and notifySettingsChange"
```

---

## Task 6: Discord settings schema

**Files:**
- Create: `packages/plugins/discord/src/_helpers/settings-schema.ts`
- Create: `packages/plugins/discord/src/_helpers/__tests__/settings-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/plugins/discord/src/_helpers/__tests__/settings-schema.test.ts
import { describe, expect, it } from 'vitest';
import { settingsSchema } from '../settings-schema';

describe('settingsSchema', () => {
  it('botToken is a required secret string field', () => {
    const fields = settingsSchema.toFieldArray();
    const botToken = fields.find((f) => f.name === 'botToken');
    expect(botToken).toMatchObject({
      type: 'string',
      secret: true,
      required: true,
    });
  });

  it('toFieldArray returns at least one field', () => {
    expect(settingsSchema.toFieldArray().length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @harness/plugin-discord test
```
Expected: FAIL with `Cannot find module '../settings-schema'`

**Step 3: Implement settings-schema.ts**

```typescript
// packages/plugins/discord/src/_helpers/settings-schema.ts
import { createSettingsSchema } from '@harness/plugin-contract';

export const settingsSchema = createSettingsSchema({
  botToken: {
    type: 'string' as const,
    label: 'Bot Token',
    description: 'Discord bot token from the Developer Portal. Stored encrypted at rest.',
    secret: true,
    required: true,
  },
});
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter @harness/plugin-discord test
```
Expected: PASS

**Step 5: Commit**

```bash
git add packages/plugins/discord/src/_helpers/settings-schema.ts \
        packages/plugins/discord/src/_helpers/__tests__/settings-schema.test.ts
git commit -m "feat(discord): add settings schema for bot token"
```

---

## Task 7: Migrate Discord plugin to ctx.getSettings + onSettingsChange

**Files:**
- Modify: `packages/plugins/discord/src/index.ts`

**Background:** Currently reads `ctx.config.discordToken` (env var). Migrate to `ctx.getSettings(settingsSchema)`. Add auto-migration: if env var is set and DB is empty, write it to DB (with a deprecation warning) so existing deployments work without manual re-entry. Add `onSettingsChange` hook that reconnects the bot when settings change. Add `settingsSchema` to the exported `plugin`.

**Note:** No unit tests for Discord lifecycle (requires live Discord.js networking). Verify via typecheck only.

**Step 1: Update discord/src/index.ts**

1. Add import:
```typescript
import { settingsSchema } from './_helpers/settings-schema';
```

2. In the `start` function, replace the token retrieval block — find this section:
```typescript
const token = ctx.config.discordToken;
if (!token) {
  ctx.logger.warn('Discord plugin: DISCORD_TOKEN not set, skipping Discord connection');
  state.connected = false;
  return;
}
```
Replace with:
```typescript
const { botToken } = await ctx.getSettings(settingsSchema);
const envToken = ctx.config.discordToken;
let token = botToken;

if (!token && envToken) {
  ctx.logger.warn('Discord plugin: DISCORD_TOKEN env var detected — migrating to DB settings (env var is deprecated)');
  await ctx.db.pluginConfig.upsert({
    where: { pluginName: 'discord' },
    create: { pluginName: 'discord', enabled: true, settings: { botToken: envToken } },
    update: { settings: { botToken: envToken } },
  });
  token = envToken;
}

if (!token) {
  ctx.logger.warn('Discord plugin: no bot token configured, skipping Discord connection');
  state.connected = false;
  return;
}
```

3. Add `onSettingsChange` to the hooks returned by `register()`. The `register` currently returns `const hooks: PluginHooks = {}; return hooks;` — update it to:
```typescript
const hooks: PluginHooks = {
  onSettingsChange: async (changedPluginName) => {
    if (changedPluginName !== 'discord') return;
    ctx.logger.info('Discord plugin: settings changed, reconnecting...');
    if (state.client) {
      await state.client.destroy();
      state.client = null;
      state.connected = false;
    }
    await start(ctx);
  },
};
return hooks;
```

4. Add `settingsSchema` to the exported `plugin`:
```typescript
export const plugin: PluginDefinition = {
  name: 'discord',
  version: '1.0.0',
  register: createRegister(),
  start,
  stop,
  settingsSchema,
};
```

**Step 2: Run typecheck**

```bash
pnpm --filter @harness/plugin-discord typecheck
```
Expected: PASS

**Step 3: Commit**

```bash
git add packages/plugins/discord/src/index.ts
git commit -m "feat(discord): migrate to ctx.getSettings, add env var auto-migration, add onSettingsChange reconnect"
```

---

## Task 8: Settings reload route in web plugin

**Files:**
- Modify: `packages/plugins/web/src/_helpers/routes.ts`
- Create or modify: `packages/plugins/web/src/_helpers/__tests__/routes.test.ts`

**Step 1: Check if a routes test file already exists**

```bash
ls packages/plugins/web/src/_helpers/__tests__/
```

**Step 2: Write the failing test**

If `supertest` is not installed in the web plugin package, add it first:
```bash
pnpm --filter @harness/plugin-web add -D supertest @types/supertest
```

Create or add to the test file:
```typescript
// packages/plugins/web/src/_helpers/__tests__/routes.test.ts
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../routes';

const mockCtx = {
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  notifySettingsChange: vi.fn().mockResolvedValue(undefined),
  broadcast: vi.fn().mockResolvedValue(undefined),
  sendToThread: vi.fn().mockResolvedValue(undefined),
} as any;

const app = createApp({
  ctx: mockCtx,
  logger: mockCtx.logger,
  onChatMessage: vi.fn().mockResolvedValue(undefined),
});

describe('POST /api/plugins/:name/reload', () => {
  it('calls notifySettingsChange and returns { success: true, pluginName }', async () => {
    const res = await request(app).post('/api/plugins/discord/reload');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, pluginName: 'discord' });
    expect(mockCtx.notifySettingsChange).toHaveBeenCalledWith('discord');
  });
});
```

**Step 3: Run test to verify it fails**

```bash
pnpm --filter @harness/plugin-web test
```
Expected: FAIL (route doesn't exist)

**Step 4: Add the reload route to routes.ts**

In `packages/plugins/web/src/_helpers/routes.ts`, after the existing `/api/chat` route, add:

```typescript
app.post('/api/plugins/:name/reload', async (req, res) => {
  const { name } = req.params as { name: string };
  try {
    await ctx.notifySettingsChange(name);
    res.json({ success: true, pluginName: name });
  } catch (err) {
    ctx.logger.error(
      `Web plugin: failed to notify settings change for ${name}: ${err instanceof Error ? err.message : String(err)}`,
    );
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 5: Run test to verify it passes**

```bash
pnpm --filter @harness/plugin-web test
```
Expected: PASS

**Step 6: Commit**

```bash
git add packages/plugins/web/src/_helpers/routes.ts \
        packages/plugins/web/src/_helpers/__tests__/routes.test.ts
git commit -m "feat(web-plugin): add POST /api/plugins/:name/reload for live settings reload"
```

---

## Task 9: Plugin registry code generator

**Files:**
- Create: `scripts/generate-plugin-registry.ts`
- Create (generated output, committed): `apps/web/src/generated/plugin-settings-registry.ts`
- Modify: root `package.json` (add `plugin:generate` script)
- Modify: `turbo.json` (add `plugin:generate` task)
- Add dependency: `glob` to root devDependencies (if not already present)

**Background:** The generator:
1. Globs `packages/plugins/*/src/_helpers/settings-schema.ts` (relative to repo root)
2. Dynamically imports each schema file — tsx handles TypeScript at runtime, so this just works
3. Calls `settingsSchema.toFieldArray()` on each export
4. Writes `apps/web/src/generated/plugin-settings-registry.ts` as a plain `.ts` file — NO imports from plugin packages, just embedded JSON data

The output file is committed — it's deterministic and easy to review in PRs.

**Step 1: Install glob if not already a root devDep**

```bash
grep '"glob"' package.json || pnpm add -D glob -w
```

**Step 2: Create the generated directory**

```bash
mkdir -p apps/web/src/generated
```

**Step 3: Create scripts/generate-plugin-registry.ts**

```typescript
// scripts/generate-plugin-registry.ts
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

type FieldEntry = {
  name: string;
  type: string;
  label: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
  default?: string | number | boolean;
  options?: Array<{ label: string; value: string }>;
};

type PluginEntry = {
  pluginName: string;
  fields: FieldEntry[];
};

const main = async () => {
  const schemaFiles = await glob('packages/plugins/*/src/_helpers/settings-schema.ts', {
    cwd: ROOT,
    absolute: true,
  });

  console.log(`Found ${schemaFiles.length} settings schema file(s):`);

  const entries: PluginEntry[] = [];

  for (const absolutePath of schemaFiles) {
    // Derive plugin name from path: …/packages/plugins/PLUGIN_NAME/src/_helpers/settings-schema.ts
    const relative = absolutePath.replace(`${ROOT}/`, '');
    const parts = relative.split('/');
    const pluginName = parts[2]; // 0=packages, 1=plugins, 2=PLUGIN_NAME
    if (!pluginName) continue;

    let mod: { settingsSchema?: { toFieldArray: () => FieldEntry[] } };
    try {
      mod = await import(absolutePath);
    } catch (err) {
      console.warn(`  ⚠ ${pluginName}: failed to import — ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (!mod.settingsSchema?.toFieldArray) {
      console.warn(`  ⚠ ${pluginName}: no settingsSchema export, skipping`);
      continue;
    }

    const fields = mod.settingsSchema.toFieldArray();
    entries.push({ pluginName, fields });
    console.log(`  ✓ ${pluginName}: ${fields.length} field(s)`);
  }

  const output = `// AUTO-GENERATED by scripts/generate-plugin-registry.ts — do not edit manually
// Re-run with: pnpm plugin:generate

export type PluginSettingsField = {
  name: string;
  type: string;
  label: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
  default?: string | number | boolean;
  options?: Array<{ label: string; value: string }>;
};

export type PluginSettingsEntry = {
  pluginName: string;
  fields: PluginSettingsField[];
};

export const pluginSettingsRegistry: PluginSettingsEntry[] = ${JSON.stringify(entries, null, 2)};
`;

  const outputPath = resolve(ROOT, 'apps/web/src/generated/plugin-settings-registry.ts');
  writeFileSync(outputPath, output, 'utf-8');
  console.log(`\nWrote ${entries.length} plugin(s) to apps/web/src/generated/plugin-settings-registry.ts`);
};

main().catch((err) => {
  console.error('Generator failed:', err);
  process.exit(1);
});
```

**Step 4: Add `plugin:generate` to root package.json scripts**

In root `package.json`, add to `"scripts"`:
```json
"plugin:generate": "tsx scripts/generate-plugin-registry.ts"
```

**Step 5: Add `plugin:generate` task to turbo.json**

In `turbo.json`, add inside `"tasks"`:
```json
"plugin:generate": {
  "cache": false,
  "inputs": [
    "packages/plugins/*/src/_helpers/settings-schema.ts",
    "scripts/generate-plugin-registry.ts"
  ],
  "outputs": ["apps/web/src/generated/plugin-settings-registry.ts"]
}
```

**Step 6: Run the generator**

```bash
pnpm plugin:generate
```
Expected output:
```
Found 1 settings schema file(s):
  ✓ discord: 1 field(s)

Wrote 1 plugin(s) to apps/web/src/generated/plugin-settings-registry.ts
```

**Step 7: Verify the generated file looks correct**

```bash
cat apps/web/src/generated/plugin-settings-registry.ts
```
Expected: valid TypeScript with `pluginSettingsRegistry` array containing the Discord entry with `botToken` field.

**Step 8: Commit**

```bash
git add scripts/generate-plugin-registry.ts \
        apps/web/src/generated/plugin-settings-registry.ts \
        package.json \
        turbo.json
git commit -m "feat: add plugin registry code generator and initial generated registry"
```

---

## Task 10: HARNESS_ENCRYPTION_KEY env config

**Files:**
- Modify: `.env.example`

**Step 1: Add the key to .env.example**

After the `ORCHESTRATOR_URL` line, add:
```bash
# 256-bit AES encryption key as 64 hex characters (required for secret plugin settings)
# Generate with: openssl rand -hex 32
HARNESS_ENCRYPTION_KEY=""
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add HARNESS_ENCRYPTION_KEY to .env.example"
```

---

## Task 11: Add @harness/plugin-contract to web app and update coverage gate

**Files:**
- Modify: `apps/web/package.json` (add dep via pnpm)
- Modify: `apps/web/next.config.ts` (add to transpilePackages)
- Modify: `scripts/coverage-gate.py` (add exclusions)

**Step 1: Add @harness/plugin-contract to web app**

```bash
pnpm --filter web add @harness/plugin-contract
```

**Step 2: Add to transpilePackages in next.config.ts**

In `apps/web/next.config.ts`, update the existing line:
```typescript
// Before:
transpilePackages: ['ui', 'database'],
// After:
transpilePackages: ['ui', 'database', '@harness/plugin-contract'],
```

**Step 3: Add exclusions to coverage-gate.py**

In `scripts/coverage-gate.py`, add to `EXCLUDED_PATTERNS` (after the existing entries):
```python
r"src/generated/",         # auto-generated files — no logic to test
r"settings-schema\.ts$",   # pure data declarations — no logic to test
```

**Step 4: Run typecheck**

```bash
pnpm --filter web typecheck
```
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/package.json apps/web/next.config.ts scripts/coverage-gate.py
git commit -m "feat(web): add @harness/plugin-contract dep, transpilePackages, and coverage gate exclusions"
```

---

## Task 12: savePluginSettings server action

**Files:**
- Create: `apps/web/src/app/admin/plugins/[name]/_actions/save-plugin-settings.ts`
- Create: `apps/web/src/app/admin/plugins/[name]/_actions/__tests__/save-plugin-settings.test.ts`

**Note:** The server action itself requires Next.js runtime context for `revalidatePath` and `import '@/generated/...'`. Extract the pure encryption logic into a testable export (`buildSettingsPayload`) and test that. The integration path (DB write + orchestrator reload) is covered by end-to-end manual testing in Task 16.

**Step 1: Write the failing test**

```typescript
// apps/web/src/app/admin/plugins/[name]/_actions/__tests__/save-plugin-settings.test.ts
import { describe, expect, it } from 'vitest';
import { buildSettingsPayload } from '../save-plugin-settings';

const TEST_KEY = 'a'.repeat(64); // 32-byte key as 64 hex chars

describe('buildSettingsPayload', () => {
  it('encrypts secret fields when encryption key is provided', () => {
    const fields = [
      { name: 'botToken', type: 'string', label: 'Bot Token', secret: true },
      { name: 'channelId', type: 'string', label: 'Channel ID' },
    ];
    const payload = buildSettingsPayload(fields, { botToken: 'my-secret', channelId: 'C123' }, TEST_KEY);

    expect(payload['channelId']).toBe('C123');
    // encrypted: iv:tag:ciphertext — all hex segments
    expect(payload['botToken']).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });

  it('passes non-secret fields through as-is', () => {
    const fields = [{ name: 'port', type: 'number', label: 'Port' }];
    const payload = buildSettingsPayload(fields, { port: '8080' }, TEST_KEY);
    expect(payload['port']).toBe('8080');
  });

  it('skips fields with no value in formData', () => {
    const fields = [{ name: 'optional', type: 'string', label: 'Optional' }];
    const payload = buildSettingsPayload(fields, {}, TEST_KEY);
    expect(payload['optional']).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter web test
```
Expected: FAIL with `Cannot find module '../save-plugin-settings'`

**Step 3: Implement save-plugin-settings.ts**

Note: You must create the `[name]/_actions/` and `[name]/_actions/__tests__/` directories as needed. The square-bracket directory name requires quoting in shell commands.

```typescript
// apps/web/src/app/admin/plugins/[name]/_actions/save-plugin-settings.ts
'use server';

import { prisma } from 'database';
import { encryptValue } from '@harness/plugin-contract';
import { revalidatePath } from 'next/cache';
import type { PluginSettingsField } from '@/generated/plugin-settings-registry';

const ENCRYPTION_KEY = process.env['HARNESS_ENCRYPTION_KEY'] ?? '';
const ORCHESTRATOR_URL = process.env['ORCHESTRATOR_URL'] ?? 'http://localhost:3001';

export type BuildSettingsPayload = (
  fields: PluginSettingsField[],
  formData: Record<string, string>,
  encryptionKey: string,
) => Record<string, unknown>;

export const buildSettingsPayload: BuildSettingsPayload = (fields, formData, encryptionKey) => {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = formData[field.name];
    if (value === undefined) continue;
    if (field.secret && encryptionKey && value) {
      payload[field.name] = encryptValue(value, encryptionKey);
    } else {
      payload[field.name] = value;
    }
  }
  return payload;
};

type SavePluginSettings = (
  pluginName: string,
  formData: Record<string, string>,
) => Promise<{ success: boolean; error?: string }>;

export const savePluginSettings: SavePluginSettings = async (pluginName, formData) => {
  try {
    const { pluginSettingsRegistry } = await import('@/generated/plugin-settings-registry');
    const entry = pluginSettingsRegistry.find((e) => e.pluginName === pluginName);
    const fields = entry?.fields ?? [];

    const settings = buildSettingsPayload(fields, formData, ENCRYPTION_KEY);

    await prisma.pluginConfig.upsert({
      where: { pluginName },
      create: { pluginName, enabled: true, settings },
      update: { settings },
    });

    // Non-blocking reload notification — orchestrator may not be running
    try {
      await fetch(`${ORCHESTRATOR_URL}/api/plugins/${pluginName}/reload`, { method: 'POST' });
    } catch {
      // intentionally swallowed
    }

    revalidatePath(`/admin/plugins/${pluginName}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
};
```

**Step 4: Run test to verify it passes**

```bash
pnpm --filter web test
```
Expected: PASS

**Step 5: Commit**

```bash
git add "apps/web/src/app/admin/plugins/[name]/_actions/save-plugin-settings.ts" \
        "apps/web/src/app/admin/plugins/[name]/_actions/__tests__/save-plugin-settings.test.ts"
git commit -m "feat(web): add savePluginSettings server action with encryption and orchestrator reload"
```

---

## Task 13: SettingsForm component

**Files:**
- Create: `apps/web/src/app/admin/plugins/[name]/_components/settings-form.tsx`

**Note:** `useActionState` components require a React testing environment that's not configured in this codebase. Verify via typecheck and visual inspection in Task 16.

**Step 1: Create settings-form.tsx**

```tsx
// apps/web/src/app/admin/plugins/[name]/_components/settings-form.tsx
'use client';

import { useActionState } from 'react';
import { Button, Input, Label } from 'ui';
import { savePluginSettings } from '../_actions/save-plugin-settings';
import type { PluginSettingsField } from '@/generated/plugin-settings-registry';

type SettingsFormProps = {
  pluginName: string;
  fields: PluginSettingsField[];
  currentValues: Record<string, string>;
  disabled?: boolean;
};

type FormState = { success?: boolean; error?: string } | null;

type SettingsFormComponent = (props: SettingsFormProps) => React.ReactNode;

export const SettingsForm: SettingsFormComponent = ({ pluginName, fields, currentValues, disabled }) => {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      const data: Record<string, string> = {};
      for (const field of fields) {
        data[field.name] = (formData.get(field.name) as string) ?? '';
      }
      return savePluginSettings(pluginName, data);
    },
    null,
  );

  const hasRequired = fields.some((f) => f.required);

  return (
    <form action={formAction} className='space-y-6'>
      {hasRequired && (
        <div className='rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800'>
          Fields marked with <span className='font-semibold'>*</span> are required for this plugin to function.
        </div>
      )}

      {state?.error && (
        <div className='rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive'>
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className='rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800'>
          Settings saved successfully.
        </div>
      )}

      {fields.map((field) => (
        <div key={field.name} className='space-y-1.5'>
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className='ml-1 text-destructive'>*</span>}
          </Label>
          {field.description && (
            <p className='text-sm text-muted-foreground'>{field.description}</p>
          )}
          {field.type === 'select' && field.options ? (
            <select
              id={field.name}
              name={field.name}
              defaultValue={currentValues[field.name] ?? String(field.default ?? '')}
              disabled={disabled}
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
            >
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={field.name}
              name={field.name}
              type={field.secret ? 'password' : field.type === 'number' ? 'number' : 'text'}
              defaultValue={field.secret ? '' : (currentValues[field.name] ?? String(field.default ?? ''))}
              placeholder={field.secret && currentValues[field.name] ? '••••••••' : undefined}
              disabled={disabled}
              className={field.required && !currentValues[field.name] ? 'border-destructive' : ''}
            />
          )}
        </div>
      ))}

      <Button type='submit' disabled={disabled || isPending}>
        {isPending ? 'Saving…' : 'Save Settings'}
      </Button>
    </form>
  );
};
```

**Step 2: Run typecheck**

```bash
pnpm --filter web typecheck
```
Expected: PASS

**Step 3: Commit**

```bash
git add "apps/web/src/app/admin/plugins/[name]/_components/settings-form.tsx"
git commit -m "feat(web): add SettingsForm component for plugin settings"
```

---

## Task 14: Admin plugins layout and VS Code-style navigation

**Files:**
- Create/Modify: `apps/web/src/app/admin/plugins/layout.tsx`
- Create: `apps/web/src/app/admin/plugins/_components/plugins-nav.tsx`

**Step 1: Check if layout.tsx already exists**

```bash
ls apps/web/src/app/admin/plugins/
```
If `layout.tsx` exists, read it before editing. If not, create it fresh.

**Step 2: Create plugins-nav.tsx**

```tsx
// apps/web/src/app/admin/plugins/_components/plugins-nav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from 'ui';
import type { PluginConfig } from 'database';

type PluginsNavProps = { configs: PluginConfig[] };

type PluginsNavComponent = (props: PluginsNavProps) => React.ReactNode;

export const PluginsNav: PluginsNavComponent = ({ configs }) => {
  const pathname = usePathname();

  return (
    <nav className='flex flex-col gap-1 p-3'>
      <Link
        href='/admin/plugins'
        className={cn(
          'rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted',
          pathname === '/admin/plugins' && 'bg-muted font-medium',
        )}
      >
        All Plugins
      </Link>
      {configs.map((config) => (
        <Link
          key={config.pluginName}
          href={`/admin/plugins/${config.pluginName}`}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted',
            pathname === `/admin/plugins/${config.pluginName}` && 'bg-muted font-medium',
          )}
        >
          <span
            className={cn(
              'size-2 shrink-0 rounded-full',
              config.enabled ? 'bg-green-500' : 'bg-muted-foreground',
            )}
          />
          {config.pluginName}
        </Link>
      ))}
    </nav>
  );
};
```

**Step 3: Create or update layout.tsx**

```tsx
// apps/web/src/app/admin/plugins/layout.tsx
import { prisma } from 'database';
import { PluginsNav } from './_components/plugins-nav';

type PluginsLayoutProps = { children: React.ReactNode };

type PluginsLayoutComponent = (props: PluginsLayoutProps) => Promise<React.ReactNode>;

const PluginsLayout: PluginsLayoutComponent = async ({ children }) => {
  const configs = await prisma.pluginConfig.findMany({ orderBy: { pluginName: 'asc' } });

  return (
    <div className='flex min-h-[calc(100vh-4rem)]'>
      <aside className='w-56 shrink-0 border-r'>
        <div className='p-4'>
          <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>Plugins</p>
        </div>
        <PluginsNav configs={configs} />
      </aside>
      <main className='flex-1 overflow-auto'>{children}</main>
    </div>
  );
};

export default PluginsLayout;
```

**Step 4: Run typecheck**

```bash
pnpm --filter web typecheck
```
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/admin/plugins/layout.tsx \
        apps/web/src/app/admin/plugins/_components/plugins-nav.tsx
git commit -m "feat(web): add VS Code-style plugin nav layout for admin/plugins"
```

---

## Task 15: Plugin settings detail page

**Files:**
- Create: `apps/web/src/app/admin/plugins/[name]/page.tsx`

**Step 1: Create the page**

```tsx
// apps/web/src/app/admin/plugins/[name]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from 'database';
import { pluginSettingsRegistry } from '@/generated/plugin-settings-registry';
import { SettingsForm } from './_components/settings-form';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ name: string }> };

type PluginSettingsPageComponent = (props: PageProps) => Promise<React.ReactNode>;

const PluginSettingsPage: PluginSettingsPageComponent = async ({ params }) => {
  const { name } = await params;

  const entry = pluginSettingsRegistry.find((e) => e.pluginName === name);
  if (!entry) {
    notFound();
  }

  const config = await prisma.pluginConfig.findUnique({ where: { pluginName: name } });
  const rawSettings = (config?.settings ?? {}) as Record<string, string>;

  // Mask secret field values — never send decrypted data to the browser
  const displayValues: Record<string, string> = {};
  for (const field of entry.fields) {
    if (field.secret) {
      displayValues[field.name] = rawSettings[field.name] ? '••••••••' : '';
    } else {
      displayValues[field.name] = rawSettings[field.name] ?? '';
    }
  }

  return (
    <div className='max-w-xl space-y-6 p-6'>
      <div>
        <h2 className='text-2xl font-semibold capitalize'>{name}</h2>
        <p className='mt-1 text-muted-foreground'>Configure the {name} plugin settings.</p>
        {!config?.enabled && (
          <div className='mt-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800'>
            This plugin is currently <strong>disabled</strong>. Settings are saved but will not take
            effect until the plugin is enabled.
          </div>
        )}
      </div>

      <SettingsForm
        pluginName={name}
        fields={entry.fields}
        currentValues={displayValues}
      />
    </div>
  );
};

export default PluginSettingsPage;
```

**Step 2: Run typecheck**

```bash
pnpm --filter web typecheck
```
Expected: PASS

**Step 3: Commit**

```bash
git add "apps/web/src/app/admin/plugins/[name]/page.tsx"
git commit -m "feat(web): add plugin settings detail page at /admin/plugins/[name]"
```

---

## Task 16: End-to-end validation

**This is a manual verification + full CI task.**

**Step 1: Run full test suite**

```bash
pnpm test
```
Expected: all tests PASS

**Step 2: Run full CI pipeline**

```bash
pnpm ci
```
Expected: sherif → typecheck → lint → build all PASS

**Step 3: Re-run generator to confirm it's idempotent**

```bash
pnpm plugin:generate
```
Expected: `✓ discord: 1 field(s)` — output file unchanged (git shows no diff)

**Step 4: Start dev environment and verify manually**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/admin/plugins`:
- Left nav shows "All Plugins" + "discord" link with green/grey indicator dot
- Clicking "discord" navigates to `/admin/plugins/discord`
- Discord settings page shows Bot Token (password input, red asterisk for required)
- Enter a test bot token value, click "Save Settings"
- Success banner appears
- Open Prisma Studio (`pnpm db:studio`) — verify `plugin_configs` table has a `discord` row with encrypted `botToken` in `settings` JSON (value should match `iv:tag:ciphertext` format)
- Check orchestrator logs — should show "Discord plugin: settings changed, reconnecting..." then attempt to connect with the new token
