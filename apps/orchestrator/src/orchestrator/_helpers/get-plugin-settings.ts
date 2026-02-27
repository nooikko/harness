import type { InferSettings, PluginSettingsSchemaInstance, SettingsFieldDefs } from '@harness/plugin-contract';
import { decryptValue } from '@harness/plugin-contract';
import type { PrismaClient } from 'database';

const ENCRYPTION_KEY = process.env.HARNESS_ENCRYPTION_KEY ?? '';

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
    if (value === undefined || value === null) {
      continue;
    }

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
