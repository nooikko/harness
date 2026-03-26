import type { PluginContext, PluginDefinition } from '@harness/plugin-contract';
import { hexToRgbInt, namedColorToRgbInt } from './_helpers/color-convert';
import { createDeviceCache, type DeviceCache } from './_helpers/device-cache';
import { formatDevices } from './_helpers/format-helpers';
import { createGoveeClient, type GoveeClient } from './_helpers/govee-client';
import type { GoveeDevice } from './_helpers/govee-types';
import { createRateLimiter, type RateLimiter } from './_helpers/rate-limiter';
import { type GoveeSettings, settingsSchema } from './_helpers/settings-schema';

/**
 * Govee Cloud API rate limits:
 * - 10 requests per minute per device
 * - 10,000 requests per day per account
 *
 * The rate limiter enforces these limits client-side to avoid 429 errors.
 * State is in-memory (resets on restart — harmless, Govee server tracks the real limit).
 */

let client: GoveeClient | null = null;
let deviceCache: DeviceCache | null = null;
let rateLimiter: RateLimiter | null = null;

// Virtual device groups stored in memory (persisted to PluginConfig on change)
let groups: Record<string, string[]> = {}; // groupName -> deviceMac[]

const resolveColor = (color: string): number => {
  const fromNamed = namedColorToRgbInt(color);
  if (fromNamed !== null) {
    return fromNamed;
  }
  return hexToRgbInt(color);
};

const ensureConnected = (): { client: GoveeClient; cache: DeviceCache; limiter: RateLimiter } => {
  if (!client || !deviceCache || !rateLimiter) {
    throw new Error('Govee not connected. Configure your API key in plugin settings.');
  }
  return { client, cache: deviceCache, limiter: rateLimiter };
};

const resolveDevice = (cache: DeviceCache, nameOrMac: string): GoveeDevice | undefined => {
  return cache.findByName(nameOrMac) ?? cache.findByMac(nameOrMac);
};

const initClient = async (ctx: PluginContext): Promise<void> => {
  const settings = (await ctx.getSettings(settingsSchema)) as GoveeSettings;

  if (!settings.apiKey) {
    client = null;
    deviceCache = null;
    rateLimiter = null;
    ctx.reportStatus('degraded', 'No API key configured. Get one from Govee Home App → Settings → Apply for API Key.', {});
    return;
  }

  rateLimiter = createRateLimiter({ perDevicePerMinute: 10, dailyLimit: 10_000 });
  client = createGoveeClient({ apiKey: settings.apiKey }, rateLimiter);
  deviceCache = createDeviceCache(client);

  try {
    await deviceCache.refresh();
    ctx.reportStatus('healthy', `Connected — ${deviceCache.devices.length} devices`, {
      devices: deviceCache.devices.length,
    });
    ctx.logger.info(`govee: Connected — ${deviceCache.devices.length} devices`);
  } catch (err) {
    deviceCache = null;
    ctx.reportStatus('error', 'Failed to connect to Govee API', {
      error: err instanceof Error ? err.message : String(err),
    });
    ctx.logger.error(`govee: Failed to connect: ${err}`);
  }

  // Load virtual groups from PluginConfig metadata
  try {
    const config = await ctx.db.pluginConfig.findUnique({ where: { pluginName: 'govee' } });
    const settings = config?.settings as Record<string, unknown> | null;
    if (settings?.groups && typeof settings.groups === 'object') {
      groups = settings.groups as Record<string, string[]>;
    }
  } catch {
    // Groups are optional, ignore errors
  }
};

const saveGroups = async (ctx: PluginContext): Promise<void> => {
  try {
    const config = await ctx.db.pluginConfig.findUnique({ where: { pluginName: 'govee' } });
    const existing = (config?.settings as Record<string, unknown>) ?? {};
    await ctx.db.pluginConfig.update({
      where: { pluginName: 'govee' },
      data: { settings: { ...existing, groups } },
    });
  } catch {
    // Best-effort persistence
  }
};

export const goveePlugin: PluginDefinition = {
  name: 'govee',
  version: '1.0.0',
  settingsSchema,

  tools: [
    {
      name: 'list_devices',
      audience: 'agent',
      description: 'List all Govee devices with their capabilities (on/off, brightness, color, color temp, scenes).',
      schema: { type: 'object', properties: {} },
      handler: async () => {
        const { cache } = ensureConnected();
        await cache.refresh();
        return formatDevices(cache.devices);
      },
    },
    {
      name: 'set_light',
      audience: 'agent',
      description:
        "Control a Govee device by name or MAC. Set on/off, brightness (1-100), color temperature (2000-9000K), or color (hex like #ff6600 or name like 'red'). Rate limit: 10 commands/minute per device.",
      schema: {
        type: 'object',
        properties: {
          device: { type: 'string', description: 'Device name or MAC address' },
          on: { type: 'boolean', description: 'Turn on (true) or off (false)' },
          brightness: { type: 'number', description: 'Brightness 1-100' },
          colorTemp: { type: 'number', description: 'Color temperature in Kelvin (2000-9000)' },
          color: { type: 'string', description: 'Color as hex (#ff6600) or name (red, warm white)' },
        },
        required: ['device'],
      },
      handler: async (_ctx, input) => {
        const { client: c, cache, limiter: _limiter } = ensureConnected();
        const {
          device: nameOrMac,
          on,
          brightness,
          colorTemp,
          color,
        } = input as {
          device: string;
          on?: boolean;
          brightness?: number;
          colorTemp?: number;
          color?: string;
        };

        // Resolve all matching devices — "office" matches Office 1 + Office 2,
        // "office 2" matches only Office 2, MAC address matches exactly one.
        const devices = cache.findAllByName(nameOrMac);
        if (devices.length === 0) {
          const byMac = cache.findByMac(nameOrMac);
          if (byMac) {
            devices.push(byMac);
          }
        }
        if (devices.length === 0) {
          return `Device "${nameOrMac}" not found.`;
        }

        const applyToDevice = async (device: GoveeDevice): Promise<string[]> => {
          const results: string[] = [];

          if (on !== undefined) {
            await c.controlDevice(device.sku, device.device, {
              type: 'devices.capabilities.on_off',
              instance: 'powerSwitch',
              value: on ? 1 : 0,
            });
            results.push(on ? 'turned on' : 'turned off');
          }

          if (brightness !== undefined) {
            await c.controlDevice(device.sku, device.device, {
              type: 'devices.capabilities.range',
              instance: 'brightness',
              value: Math.max(1, Math.min(100, brightness)),
            });
            results.push(`brightness: ${brightness}%`);
          }

          if (colorTemp !== undefined) {
            await c.controlDevice(device.sku, device.device, {
              type: 'devices.capabilities.color_setting',
              instance: 'colorTemperatureK',
              value: Math.max(2000, Math.min(9000, colorTemp)),
            });
            results.push(`color temp: ${colorTemp}K`);
          }

          if (color !== undefined) {
            const rgbInt = resolveColor(color);
            await c.controlDevice(device.sku, device.device, {
              type: 'devices.capabilities.color_setting',
              instance: 'colorRgb',
              value: rgbInt,
            });
            results.push(`color: ${color}`);
          }

          return results;
        };

        const allResults = await Promise.all(
          devices.map(async (device) => {
            const results = await applyToDevice(device);
            return { name: device.deviceName, results };
          }),
        );

        const successful = allResults.filter((r) => r.results.length > 0);
        if (successful.length === 0) {
          return `No changes specified for "${nameOrMac}".`;
        }

        // Compact format: if all devices got the same changes, summarize
        const firstAction = successful[0]!.results.join(', ');
        const allSame = successful.every((r) => r.results.join(', ') === firstAction);

        if (allSame && successful.length > 1) {
          return `${successful.length} "${nameOrMac}" devices: ${firstAction}.`;
        }

        if (successful.length === 1) {
          return `"${successful[0]!.name}": ${firstAction}.`;
        }

        return successful.map((r) => `"${r.name}": ${r.results.join(', ')}.`).join('\n');
      },
    },
    {
      name: 'toggle_light',
      audience: 'agent',
      description: 'Toggle a Govee device on or off (reads current state and inverts). Rate limit: 10 commands/minute per device.',
      schema: {
        type: 'object',
        properties: {
          device: { type: 'string', description: 'Device name or MAC address' },
        },
        required: ['device'],
      },
      handler: async (_ctx, input) => {
        const { client: c, cache } = ensureConnected();
        const { device: nameOrMac } = input as { device: string };

        const devices = cache.findAllByName(nameOrMac);
        if (devices.length === 0) {
          const byMac = cache.findByMac(nameOrMac);
          if (byMac) {
            devices.push(byMac);
          }
        }
        if (devices.length === 0) {
          return `Device "${nameOrMac}" not found.`;
        }

        const results = await Promise.all(
          devices.map(async (device) => {
            const state = await c.getDeviceState(device.sku, device.device);
            const powerCap = state.capabilities.find((cap) => cap.instance === 'powerSwitch');
            const currentlyOn = powerCap?.state.value === 1;
            const newValue = currentlyOn ? 0 : 1;

            await c.controlDevice(device.sku, device.device, {
              type: 'devices.capabilities.on_off',
              instance: 'powerSwitch',
              value: newValue,
            });

            return { name: device.deviceName, action: newValue === 1 ? 'ON' : 'OFF' };
          }),
        );

        if (results.length === 1) {
          return `"${results[0]!.name}": toggled ${results[0]!.action}.`;
        }

        const allSame = results.every((r) => r.action === results[0]!.action);
        if (allSame) {
          return `${results.length} "${nameOrMac}" devices: toggled ${results[0]!.action}.`;
        }

        return results.map((r) => `"${r.name}": toggled ${r.action}.`).join('\n');
      },
    },
    {
      name: 'list_scenes',
      audience: 'agent',
      description: 'List available scenes for a specific Govee device.',
      schema: {
        type: 'object',
        properties: {
          device: { type: 'string', description: 'Device name or MAC address' },
        },
        required: ['device'],
      },
      handler: async (_ctx, input) => {
        const { cache } = ensureConnected();
        const { device: nameOrMac } = input as { device: string };

        const device = resolveDevice(cache, nameOrMac);
        if (!device) {
          return `Device "${nameOrMac}" not found.`;
        }

        const sceneCaps = device.capabilities.filter(
          (c) => c.type === 'devices.capabilities.mode' && (c.instance === 'lightScene' || c.instance === 'diyScene'),
        );

        if (sceneCaps.length === 0) {
          return `Device "${device.deviceName}" does not support scenes.`;
        }

        const lines: string[] = [`## Scenes for ${device.deviceName}\n`];
        for (const cap of sceneCaps) {
          const options = cap.parameters?.options ?? [];
          lines.push(`### ${cap.instance === 'lightScene' ? 'Light Scenes' : 'DIY Scenes'}`);
          for (const opt of options) {
            lines.push(`- ${opt.name} (value: ${JSON.stringify(opt.value)})`);
          }
        }

        return lines.join('\n');
      },
    },
    {
      name: 'set_scene',
      audience: 'agent',
      description: 'Activate a scene on a Govee device. Use list_scenes to find available scene values.',
      schema: {
        type: 'object',
        properties: {
          device: { type: 'string', description: 'Device name or MAC address' },
          scene: { type: 'string', description: 'Scene name or value' },
          type: {
            type: 'string',
            description: "Scene type: 'lightScene' or 'diyScene' (default: lightScene)",
          },
        },
        required: ['device', 'scene'],
      },
      handler: async (_ctx, input) => {
        const { client: c, cache } = ensureConnected();
        const {
          device: nameOrMac,
          scene,
          type: sceneType = 'lightScene',
        } = input as {
          device: string;
          scene: string;
          type?: string;
        };

        const device = resolveDevice(cache, nameOrMac);
        if (!device) {
          return `Device "${nameOrMac}" not found.`;
        }

        // Try to find scene by name in capabilities
        const sceneCap = device.capabilities.find((c) => c.type === 'devices.capabilities.mode' && c.instance === sceneType);

        if (!sceneCap) {
          return `Device "${device.deviceName}" does not support ${sceneType}.`;
        }

        const option = sceneCap.parameters?.options?.find((o) => o.name.toLowerCase() === scene.toLowerCase());
        const sceneValue = option?.value ?? scene;

        await c.controlDevice(device.sku, device.device, {
          type: 'devices.capabilities.mode',
          instance: sceneType,
          value: sceneValue,
        });

        return `Activated scene "${option?.name ?? scene}" on "${device.deviceName}".`;
      },
    },
    {
      name: 'list_groups',
      audience: 'agent',
      description: 'List virtual device groups.',
      schema: { type: 'object', properties: {} },
      handler: async () => {
        const entries = Object.entries(groups);
        if (entries.length === 0) {
          return 'No groups defined. Use create_group to create one.';
        }

        const lines = entries.map(([name, macs]) => `- **${name}** (${macs.length} devices): ${macs.join(', ')}`);
        return `## Groups\n\n${lines.join('\n')}`;
      },
    },
    {
      name: 'create_group',
      audience: 'agent',
      description: 'Create a virtual group of devices for batch control.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Group name' },
          devices: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of device names or MAC addresses',
          },
        },
        required: ['name', 'devices'],
      },
      handler: async (ctx, input) => {
        const { cache } = ensureConnected();
        const { name, devices: deviceNames } = input as { name: string; devices: string[] };

        const macs: string[] = [];
        const notFound: string[] = [];
        for (const nameOrMac of deviceNames) {
          const device = resolveDevice(cache, nameOrMac);
          if (device) {
            macs.push(device.device);
          } else {
            notFound.push(nameOrMac);
          }
        }

        if (macs.length === 0) {
          return `No valid devices found. Not found: ${notFound.join(', ')}`;
        }

        groups[name] = macs;
        await saveGroups(ctx);

        const result = `Created group "${name}" with ${macs.length} devices.`;
        if (notFound.length > 0) {
          return `${result} Not found: ${notFound.join(', ')}`;
        }
        return result;
      },
    },
    {
      name: 'delete_group',
      audience: 'agent',
      description: 'Delete a virtual device group.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Group name to delete' },
        },
        required: ['name'],
      },
      handler: async (ctx, input) => {
        const { name } = input as { name: string };

        if (!groups[name]) {
          return `Group "${name}" not found.`;
        }

        delete groups[name];
        await saveGroups(ctx);

        return `Deleted group "${name}".`;
      },
    },
    {
      name: 'set_group',
      audience: 'agent',
      description:
        'Control all devices in a virtual group. Set on/off, brightness, color temp, or color. Commands are sent sequentially respecting rate limits (10/min per device).',
      schema: {
        type: 'object',
        properties: {
          group: { type: 'string', description: 'Group name' },
          on: { type: 'boolean' },
          brightness: { type: 'number', description: 'Brightness 1-100' },
          colorTemp: { type: 'number', description: 'Color temperature in Kelvin (2000-9000)' },
          color: { type: 'string', description: 'Color as hex (#ff6600) or name' },
        },
        required: ['group'],
      },
      handler: async (_ctx, input) => {
        const { client: c, cache } = ensureConnected();
        const {
          group: groupName,
          on,
          brightness,
          colorTemp,
          color,
        } = input as {
          group: string;
          on?: boolean;
          brightness?: number;
          colorTemp?: number;
          color?: string;
        };

        const macs = groups[groupName];
        if (!macs || macs.length === 0) {
          return `Group "${groupName}" not found or empty.`;
        }

        const results: string[] = [];
        const errors: string[] = [];

        for (const mac of macs) {
          const device = cache.findByMac(mac);
          if (!device) {
            errors.push(`${mac}: not found in device cache`);
            continue;
          }

          try {
            if (on !== undefined) {
              await c.controlDevice(device.sku, device.device, {
                type: 'devices.capabilities.on_off',
                instance: 'powerSwitch',
                value: on ? 1 : 0,
              });
            }
            if (brightness !== undefined) {
              await c.controlDevice(device.sku, device.device, {
                type: 'devices.capabilities.range',
                instance: 'brightness',
                value: Math.max(1, Math.min(100, brightness)),
              });
            }
            if (colorTemp !== undefined) {
              await c.controlDevice(device.sku, device.device, {
                type: 'devices.capabilities.color_setting',
                instance: 'colorTemperatureK',
                value: Math.max(2000, Math.min(9000, colorTemp)),
              });
            }
            if (color !== undefined) {
              await c.controlDevice(device.sku, device.device, {
                type: 'devices.capabilities.color_setting',
                instance: 'colorRgb',
                value: resolveColor(color),
              });
            }
            results.push(device.deviceName);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${device.deviceName}: ${msg}`);
          }
        }

        const parts: string[] = [];
        if (results.length > 0) {
          parts.push(`Updated ${results.length} devices: ${results.join(', ')}`);
        }
        if (errors.length > 0) {
          parts.push(`Errors: ${errors.join('; ')}`);
        }
        return parts.join('. ') || 'No changes applied.';
      },
    },
    {
      name: 'get_status',
      audience: 'agent',
      description: 'Get Govee plugin status including device count, rate limit usage, and group info.',
      schema: { type: 'object', properties: {} },
      handler: async () => {
        if (!rateLimiter) {
          return 'Not connected. Configure your API key in plugin settings.';
        }

        const status = rateLimiter.getStatus();
        const parts = [
          '## Govee Status',
          `- Devices: ${deviceCache?.devices.length ?? 0}`,
          `- Groups: ${Object.keys(groups).length}`,
          `- Daily API usage: ${status.dailyUsed}/${status.dailyLimit}`,
          '',
          '### Per-Device Usage (last 60s)',
        ];

        const deviceEntries = Object.entries(status.devices);
        if (deviceEntries.length === 0) {
          parts.push('- No recent requests');
        } else {
          for (const [deviceId, count] of deviceEntries) {
            const name = deviceCache?.findByMac(deviceId)?.deviceName ?? deviceId;
            parts.push(`- ${name}: ${count}/10`);
          }
        }

        return parts.join('\n');
      },
    },
  ],

  start: async (ctx) => {
    ctx.logger.info('govee: Starting...');
    await initClient(ctx);
    ctx.logger.info('govee: Started.');
  },

  stop: async (ctx) => {
    ctx.logger.info('govee: Shutting down...');
    deviceCache?.clear();
    deviceCache = null;
    client = null;
    rateLimiter?.reset();
    rateLimiter = null;
    groups = {};
    ctx.logger.info('govee: Stopped.');
  },

  register: async (_ctx) => ({
    onSettingsChange: async (pluginName: string) => {
      if (pluginName !== 'govee') {
        return;
      }
      _ctx.logger.info('govee: Settings changed, reinitializing...');
      await initClient(_ctx);
    },
  }),
};
