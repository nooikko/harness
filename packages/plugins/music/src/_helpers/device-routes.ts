import type { PluginContext, PluginRoute } from '@harness/plugin-contract';
import { getDeviceStatuses, listDevices, resolveDeviceById } from './cast-device-manager';
import { getDeviceAliases, setDeviceAlias } from './device-alias-manager';

// --- Types ---

type PlaybackControllerRef = {
  identifyDevice: (deviceId: string) => Promise<string>;
};

// --- Route factory ---

type CreateDeviceRoutes = (controllerRef: PlaybackControllerRef) => PluginRoute[];

export const createDeviceRoutes: CreateDeviceRoutes = (controllerRef) => [
  {
    method: 'GET',
    path: '/devices',
    handler: async (ctx: PluginContext, _req) => {
      const devices = listDevices();

      // Load aliases from settings
      const existing = await ctx.db.pluginConfig.findUnique({
        where: { pluginName: 'music' },
      });
      const settings = (existing?.settings ?? {}) as Record<string, unknown>;
      const aliases = getDeviceAliases(settings as Parameters<typeof getDeviceAliases>[0]);

      const statuses = getDeviceStatuses();

      const deviceList = devices.map((d) => ({
        id: d.id,
        name: d.name,
        alias: aliases[d.id] ?? null,
        model: d.model ?? null,
        host: d.host,
        port: d.port,
        status: statuses.get(d.id) ?? 'available',
      }));

      return { status: 200, body: { devices: deviceList } };
    },
  },

  {
    method: 'POST',
    path: '/devices/alias',
    handler: async (ctx: PluginContext, req) => {
      const { deviceId, alias } = (req.body ?? {}) as {
        deviceId?: string;
        alias?: string;
      };

      if (!deviceId || !alias) {
        return {
          status: 400,
          body: { error: 'deviceId and alias are required' },
        };
      }

      await setDeviceAlias(ctx, deviceId, alias);

      // Notify settings change so alias lookup updates
      await ctx.notifySettingsChange('music');

      return { status: 200, body: { success: true, deviceId, alias } };
    },
  },

  {
    method: 'POST',
    path: '/identify-device',
    handler: async (_ctx: PluginContext, req) => {
      const { deviceId } = (req.body ?? {}) as { deviceId?: string };

      if (!deviceId) {
        return { status: 400, body: { error: 'deviceId is required' } };
      }

      // Verify device exists
      const device = resolveDeviceById(deviceId);
      if (!device) {
        return { status: 404, body: { error: `Device "${deviceId}" not found` } };
      }

      try {
        const result = await controllerRef.identifyDevice(deviceId);
        return { status: 200, body: { success: true, message: result } };
      } catch (err) {
        return {
          status: 500,
          body: { error: err instanceof Error ? err.message : 'Failed to identify device' },
        };
      }
    },
  },
];
