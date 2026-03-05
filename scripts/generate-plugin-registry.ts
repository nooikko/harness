// scripts/generate-plugin-registry.ts
import { writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Settings schema types ──────────────────────────────────────────

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

// ── Tool registry types ────────────────────────────────────────────

type ToolEntry = {
  pluginName: string;
  toolName: string;
  qualifiedName: string;
  description: string;
  args: string;
};

type SchemaProperty = {
  type?: string;
  description?: string;
};

type ToolSchema = {
  type?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
};

type PluginToolLike = {
  name: string;
  description: string;
  schema: ToolSchema;
  handler: unknown;
};

type PluginLike = {
  name?: string;
  tools?: PluginToolLike[];
};

// ── Helpers ────────────────────────────────────────────────────────

type FormatArgs = (schema: ToolSchema) => string;

const formatArgs: FormatArgs = (schema) => {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const parts: string[] = [];
  for (const propName of Object.keys(props)) {
    parts.push(required.has(propName) ? `<${propName}>` : `[${propName}]`);
  }
  return parts.join(' ');
};

type ToDashCase = (s: string) => string;

const toDashCase: ToDashCase = (s) => s.replace(/_/g, '-');

/**
 * Find the plugin definition export from a module.
 * Plugins export as: `export const plugin`, `export { fooPlugin }`, or `export const createFoo = () => ({...})`
 */
type FindPlugin = (mod: Record<string, unknown>) => PluginLike | null;

const findPlugin: FindPlugin = (mod) => {
  // First pass: check direct object exports (covers `export const plugin = { ... }`)
  for (const key of Object.keys(mod)) {
    const val = mod[key];
    if (typeof val === 'object' && val !== null && 'tools' in val && Array.isArray((val as PluginLike).tools)) {
      return val as PluginLike;
    }
  }
  // Second pass: try zero-arg factory functions (covers `export const createFoo = () => ({ ... })`)
  for (const key of Object.keys(mod)) {
    const val = mod[key];
    if (typeof val === 'function' && key.startsWith('create') && (val as { length: number }).length === 0) {
      try {
        const result = (val as () => unknown)();
        if (typeof result === 'object' && result !== null && 'tools' in result && Array.isArray((result as PluginLike).tools)) {
          return result as PluginLike;
        }
      } catch {
        // Factory failed — skip
      }
    }
  }
  return null;
};

// ── Settings schema generation ─────────────────────────────────────

type GenerateSettings = () => Promise<{
  entries: PluginEntry[];
  failures: number;
}>;

const generateSettings: GenerateSettings = async () => {
  const schemaFiles = await glob('packages/plugins/*/src/_helpers/settings-schema.ts', { cwd: ROOT, absolute: true });

  console.log(`Found ${schemaFiles.length} settings schema file(s):`);

  const entries: PluginEntry[] = [];
  let failures = 0;

  for (const absolutePath of schemaFiles) {
    const parts = relative(ROOT, absolutePath).split(sep);
    const pluginName = parts[2];
    if (pluginName === undefined) {
      continue;
    }

    let mod: { settingsSchema?: { toFieldArray: () => FieldEntry[] } };
    try {
      mod = await import(absolutePath);
    } catch (err) {
      console.warn(`  Warning: ${pluginName}: failed to import — ${err instanceof Error ? err.message : String(err)}`);
      failures++;
      continue;
    }

    if (!mod.settingsSchema?.toFieldArray) {
      console.warn(`  Warning: ${pluginName}: no settingsSchema export, skipping`);
      failures++;
      continue;
    }

    const fields = mod.settingsSchema.toFieldArray();
    entries.push({ pluginName, fields });
    console.log(`  OK: ${pluginName}: ${fields.length} field(s)`);
  }

  return { entries, failures };
};

// ── Tool registry generation ───────────────────────────────────────

type GenerateTools = () => Promise<ToolEntry[]>;

const generateTools: GenerateTools = async () => {
  const indexFiles = await glob('packages/plugins/*/src/index.ts', {
    cwd: ROOT,
    absolute: true,
  });

  console.log(`\nScanning ${indexFiles.length} plugin index file(s) for tools:`);

  const toolEntries: ToolEntry[] = [];

  for (const absolutePath of indexFiles) {
    const parts = relative(ROOT, absolutePath).split(sep);
    const pluginName = parts[2];
    if (pluginName === undefined) {
      continue;
    }

    let mod: Record<string, unknown>;
    try {
      mod = (await import(absolutePath)) as Record<string, unknown>;
    } catch (err) {
      console.warn(`  Warning: ${pluginName}: failed to import — ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const plugin = findPlugin(mod);
    if (!plugin?.tools || plugin.tools.length === 0) {
      console.log(`  Skip: ${pluginName}: no tools`);
      continue;
    }

    for (const tool of plugin.tools) {
      toolEntries.push({
        pluginName,
        toolName: toDashCase(tool.name),
        qualifiedName: `${pluginName}__${tool.name}`,
        description: tool.description,
        args: formatArgs(tool.schema),
      });
    }

    console.log(`  OK: ${pluginName}: ${plugin.tools.length} tool(s) — ${plugin.tools.map((t) => t.name).join(', ')}`);
  }

  return toolEntries;
};

// ── Main ───────────────────────────────────────────────────────────

type Main = () => Promise<void>;

const main: Main = async () => {
  const { entries, failures } = await generateSettings();

  if (failures > 0) {
    console.error(`\n${failures} schema file(s) failed to load`);
    process.exit(1);
  }

  const settingsOutput = `// AUTO-GENERATED by scripts/generate-plugin-registry.ts — do not edit manually
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

  const settingsPath = resolve(ROOT, 'apps/web/src/generated/plugin-settings-registry.ts');
  writeFileSync(settingsPath, settingsOutput, 'utf-8');
  console.log(`\nWrote ${entries.length} plugin(s) to apps/web/src/generated/plugin-settings-registry.ts`);

  // Generate tool registry
  const toolEntries = await generateTools();

  const toolsOutput = `// AUTO-GENERATED by scripts/generate-plugin-registry.ts — do not edit manually
// Re-run with: pnpm plugin:generate

export type PluginToolEntry = {
  pluginName: string;
  toolName: string;
  qualifiedName: string;
  description: string;
  args: string;
};

export const pluginToolRegistry: PluginToolEntry[] = ${JSON.stringify(toolEntries, null, 2)};
`;

  const toolsPath = resolve(ROOT, 'apps/web/src/generated/plugin-tool-registry.ts');
  writeFileSync(toolsPath, toolsOutput, 'utf-8');
  console.log(`Wrote ${toolEntries.length} tool(s) to apps/web/src/generated/plugin-tool-registry.ts`);
};

main().catch((err) => {
  console.error('Generator failed:', err);
  process.exit(1);
});
