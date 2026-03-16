import type { PluginContext } from '@harness/plugin-contract';

// --- Types ---

type MusicSettings = {
  deviceAliases?: Record<string, string>;
  [key: string]: unknown;
};

// --- Helpers ---

export const getDeviceAliases = (settings: MusicSettings): Record<string, string> => {
  return settings.deviceAliases ?? {};
};

export const setDeviceAlias = async (ctx: PluginContext, deviceId: string, alias: string): Promise<void> => {
  const existing = await ctx.db.pluginConfig.findUnique({
    where: { pluginName: 'music' },
  });

  const currentSettings = (existing?.settings ?? {}) as MusicSettings;
  const aliases = { ...getDeviceAliases(currentSettings), [deviceId]: alias };

  await ctx.db.pluginConfig.upsert({
    where: { pluginName: 'music' },
    create: {
      pluginName: 'music',
      enabled: true,
      settings: { ...currentSettings, deviceAliases: aliases },
    },
    update: {
      settings: { ...currentSettings, deviceAliases: aliases },
    },
  });
};
