import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { createAudioServer } from './_helpers/audio-server';
import { announce } from './_helpers/cast-announcer';
import { listSpeakers, resolveDevice, startDiscovery, stopDiscovery } from './_helpers/device-resolver';
import { settingsSchema } from './_helpers/settings-schema';
import type { TtsProvider } from './_helpers/tts-provider';
import { createTtsProvider } from './_helpers/tts-provider';

// --- State ---

let audioServer: ReturnType<typeof createAudioServer> | null = null;
let ttsProvider: TtsProvider | null = null;
const AUDIO_SERVER_PORT = 9849;

let currentSettings = {
  ttsProvider: 'edge-tts',
  voice: 'en-US-GuyNeural',
  volume: 70,
  defaultDevice: '',
};

// --- Helpers ---

type PerformAnnouncement = (ctx: PluginContext, message: string, deviceName?: string, volumeOverride?: number) => Promise<string>;

const performAnnouncement: PerformAnnouncement = async (ctx, message, deviceName, volumeOverride) => {
  if (!ttsProvider || !audioServer) {
    throw new Error('Notifications plugin not started. Check that the plugin is enabled and started.');
  }

  const device = resolveDevice(deviceName || currentSettings.defaultDevice || undefined);
  const volume = (volumeOverride ?? currentSettings.volume) / 100;

  ctx.logger.info(`notifications: generating TTS for "${message.slice(0, 50)}..." → ${device.name}`);

  // Generate audio
  const audioBuffer = await ttsProvider.generate(message, currentSettings.voice);

  // Register with audio server so Cast device can fetch it
  const audioUrl = audioServer.register(audioBuffer, 'audio/mpeg');

  // Cast to device
  await announce({ device, audioUrl, volume });

  return `Announced on ${device.name}: "${message}"`;
};

// --- Plugin Definition ---

export const plugin: PluginDefinition = {
  name: 'notifications',
  version: '1.0.0',
  settingsSchema,

  tools: [
    {
      name: 'announce',
      audience: 'agent',
      description: 'Speak a message on a Google Home or Cast device. Use for reminders, alerts, or any spoken notification.',
      schema: {
        type: 'object' as const,
        properties: {
          message: {
            type: 'string',
            description: 'The text to speak aloud on the Cast device.',
          },
          device: {
            type: 'string',
            description: 'Name of the Cast device to announce on. Defaults to the configured default device or first discovered.',
          },
          volume: {
            type: 'number',
            description: 'Volume percentage (0-100) for this announcement. Overrides the default setting.',
          },
        },
        required: ['message'],
      },
      handler: async (ctx, input) => {
        const { message, device, volume } = input as {
          message: string;
          device?: string;
          volume?: number;
        };
        return performAnnouncement(ctx, message, device, volume);
      },
    },
    {
      name: 'list_speakers',
      audience: 'agent',
      description: 'List all discovered Cast devices (Google Home, Nest, Chromecast) available for announcements.',
      schema: {
        type: 'object' as const,
        properties: {},
      },
      handler: async () => {
        const speakers = listSpeakers();
        if (speakers.length === 0) {
          return 'No Cast devices found on the network. Make sure devices are on the same LAN.';
        }
        return speakers.map((s) => `- ${s.name} (${s.model ?? 'unknown model'}) at ${s.host}:${s.port}`).join('\n');
      },
    },
  ],

  register: async (ctx: PluginContext): Promise<PluginHooks> => {
    const settings = await ctx.getSettings(settingsSchema);
    currentSettings = {
      ttsProvider: settings.ttsProvider ?? 'edge-tts',
      voice: settings.voice ?? 'en-US-GuyNeural',
      volume: settings.volume ?? 70,
      defaultDevice: settings.defaultDevice ?? '',
    };

    return {
      onBroadcast: async (event: string, data: unknown) => {
        if (event !== 'notification:announce') {
          return;
        }

        const payload = data as {
          message?: string;
          device?: string;
          volume?: number;
        };
        if (!payload?.message) {
          return;
        }

        try {
          await performAnnouncement(ctx, payload.message, payload.device, payload.volume);
        } catch (err) {
          ctx.logger.warn(`notifications: broadcast announcement failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      },

      onSettingsChange: async (pluginName: string) => {
        if (pluginName !== 'notifications') {
          return;
        }

        ctx.logger.info('notifications: reloading settings');
        const settings = await ctx.getSettings(settingsSchema);
        currentSettings = {
          ttsProvider: settings.ttsProvider ?? 'edge-tts',
          voice: settings.voice ?? 'en-US-GuyNeural',
          volume: settings.volume ?? 70,
          defaultDevice: settings.defaultDevice ?? '',
        };

        // Re-create TTS provider if it changed
        try {
          ttsProvider = createTtsProvider(currentSettings.ttsProvider);
        } catch (err) {
          ctx.logger.warn(`notifications: failed to create TTS provider: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    };
  },

  start: async (ctx: PluginContext): Promise<void> => {
    ctx.logger.info('notifications: starting');

    // Initialize TTS provider
    ttsProvider = createTtsProvider(currentSettings.ttsProvider);

    // Start audio server
    audioServer = createAudioServer({ port: AUDIO_SERVER_PORT });
    const info = await audioServer.start();
    ctx.logger.info(`notifications: audio server listening at http://${info.host}:${info.port}`);

    // Start Cast device discovery
    startDiscovery();
    ctx.logger.info('notifications: Cast device discovery started');
  },

  stop: async (ctx: PluginContext): Promise<void> => {
    ctx.logger.info('notifications: stopping');

    stopDiscovery();

    if (audioServer) {
      await audioServer.stop();
      audioServer = null;
    }

    ttsProvider = null;
  },
};
