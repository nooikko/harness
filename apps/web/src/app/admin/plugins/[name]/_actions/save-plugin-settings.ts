'use server';

import { prisma } from 'database';
import { revalidatePath } from 'next/cache';
import { buildSettingsPayload } from './_helpers/build-settings-payload';

const ENCRYPTION_KEY = process.env.HARNESS_ENCRYPTION_KEY ?? '';
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? 'http://localhost:3001';

type SavePluginSettings = (pluginName: string, formData: Record<string, string>) => Promise<{ success: boolean; error?: string }>;

export const savePluginSettings: SavePluginSettings = async (pluginName, formData) => {
  try {
    const { pluginSettingsRegistry } = await import('@/generated/plugin-settings-registry');
    const entry = pluginSettingsRegistry.find((e) => e.pluginName === pluginName);
    const fields = entry?.fields ?? [];

    const newSettings = buildSettingsPayload(fields, formData, ENCRYPTION_KEY);
    // Merge with existing settings so skipped empty secret fields preserve their encrypted values
    const existing = await prisma.pluginConfig.findUnique({ where: { pluginName } });
    const existingSettings = (existing?.settings ?? {}) as Record<string, string>;
    const settings = { ...existingSettings, ...newSettings };

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
