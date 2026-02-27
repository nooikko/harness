'use server';

import { encryptValue } from '@harness/plugin-contract';
import { prisma } from 'database';
import { revalidatePath } from 'next/cache';
import type { PluginSettingsField } from '@/generated/plugin-settings-registry';

const ENCRYPTION_KEY = process.env.HARNESS_ENCRYPTION_KEY ?? '';
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? 'http://localhost:3001';

export type BuildSettingsPayload = (fields: PluginSettingsField[], formData: Record<string, string>, encryptionKey: string) => Record<string, string>;

export const buildSettingsPayload: BuildSettingsPayload = (fields, formData, encryptionKey) => {
  const payload: Record<string, string> = {};
  for (const field of fields) {
    const value = formData[field.name];
    if (value === undefined) {
      continue;
    }
    // Empty string means "clear the field" — stored as-is, not encrypted
    if (field.secret && encryptionKey && value) {
      payload[field.name] = encryptValue(value, encryptionKey);
    } else {
      payload[field.name] = value;
    }
  }
  return payload;
};

type SavePluginSettings = (pluginName: string, formData: Record<string, string>) => Promise<{ success: boolean; error?: string }>;

export const savePluginSettings: SavePluginSettings = async (pluginName, formData) => {
  try {
    const { pluginSettingsRegistry } = await import('@/generated/plugin-settings-registry');
    const entry = pluginSettingsRegistry.find((e) => e.pluginName === pluginName);
    const fields = entry?.fields ?? [];

    const settings = buildSettingsPayload(fields, formData, ENCRYPTION_KEY);

    // First save enables the plugin; subsequent saves preserve the existing enabled state
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
