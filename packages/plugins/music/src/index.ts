import type { OAuthStoredCredentials, PluginContext, PluginDefinition } from '@harness/plugin-contract';
import {
  listDevices,
  resolveDevice,
  startDiscovery,
  stopDiscovery,
  updateActiveSessionIds,
  updateDeviceAliases,
} from './_helpers/cast-device-manager';
import { getDeviceAliases } from './_helpers/device-alias-manager';
import { createDeviceRoutes } from './_helpers/device-routes';
import { formatLikedSongs } from './_helpers/format-liked-songs';
import { formatPlaylists } from './_helpers/format-playlists';
import { formatQueueState } from './_helpers/format-queue-state';
import { formatSearchResults } from './_helpers/format-search-results';
import { createInnertubeApi } from './_helpers/innertube-api';
import { createOAuthRoutes } from './_helpers/oauth-routes';
import {
  addToQueue,
  destroyPlaybackController,
  getActiveSessionIds,
  getQueueState,
  identifyDevice,
  initPlaybackController,
  pausePlayback,
  playTrack,
  resumePlayback,
  setVolume,
  skipTrack,
  stopPlayback,
  updatePlaybackSettings,
} from './_helpers/playback-controller';
import { settingsSchema } from './_helpers/settings-schema';
import type { MusicTrack } from './_helpers/youtube-music-client';
import { destroyYouTubeMusicClient, getRawClient, replaceYouTubeMusicClient, searchSongs } from './_helpers/youtube-music-client';

// --- Helpers ---

type MusicSettings = {
  youtubeAuth?: OAuthStoredCredentials;
  cookie?: string;
  poToken?: string;
  defaultVolume?: number;
  radioEnabled?: boolean;
  audioQuality?: string;
  deviceAliases?: Record<string, string>;
};

const getAuthenticatedApi = (settings: MusicSettings) => {
  const auth = settings.youtubeAuth;
  if (!auth?.accessToken || !auth?.refreshToken) {
    return null;
  }
  return createInnertubeApi({
    credentials: {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresAt: auth.expiresAt ?? new Date().toISOString(),
    },
  });
};

const loadAndApplySettings = async (ctx: PluginContext): Promise<MusicSettings> => {
  const settings = (await ctx.getSettings(settingsSchema)) as MusicSettings;

  // Update playback defaults
  updatePlaybackSettings({
    defaultVolume: settings.defaultVolume,
    radioEnabled: settings.radioEnabled,
    audioQuality: settings.audioQuality,
  });

  // Update device aliases
  updateDeviceAliases(getDeviceAliases(settings));

  // Update active session tracking
  updateActiveSessionIds(getActiveSessionIds());

  return settings;
};

const initClientWithSettings = async (ctx: PluginContext, settings: MusicSettings): Promise<void> => {
  await replaceYouTubeMusicClient({
    credentials: settings.youtubeAuth,
    cookie: settings.cookie,
    poToken: settings.poToken,
  });

  ctx.logger.info(`music: Client initialized${settings.youtubeAuth ? ' (authenticated)' : settings.cookie ? ' (cookie auth)' : ' (anonymous)'}`);
};

// --- Plugin definition ---

const musicPlugin: PluginDefinition = {
  name: 'music',
  version: '1.0.0',
  settingsSchema,

  routes: [
    ...createOAuthRoutes({ getClient: () => getRawClient() }),
    ...createDeviceRoutes({
      identifyDevice: async (deviceId: string) => {
        const devices = listDevices();
        const device = devices.find((d) => d.id === deviceId);
        if (!device) {
          throw new Error(`Device "${deviceId}" not found`);
        }
        return identifyDevice(device);
      },
    }),
  ],

  tools: [
    {
      name: 'search',
      description: 'Search YouTube Music for songs. Returns a list of results with videoId, title, artist, album, and duration.',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (song name, artist, etc.)' },
          limit: { type: 'number', description: 'Max results to return (default: 5)' },
        },
        required: ['query'],
      },
      handler: async (ctx, input) => {
        const { query, limit } = input as { query: string; limit?: number };
        try {
          const results = await searchSongs(query, limit ?? 5);
          return formatSearchResults(results, query);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: search failed', { error: msg, query });
          return `search failed: ${msg}`;
        }
      },
    },

    {
      name: 'play',
      description:
        'Play a song on a Cast device (Chromecast, Google Home, Nest speaker). Provide either a search query or a specific videoId. Enables radio/autoplay by default so music keeps playing after the song ends.',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query to find and play a song' },
          videoId: { type: 'string', description: 'Specific YouTube Music video ID to play' },
          deviceName: {
            type: 'string',
            description: 'Name of the Cast device to play on. If omitted, uses the last-used or first available device.',
          },
          radio: {
            type: 'boolean',
            description: 'Enable radio/autoplay mode — keeps playing related songs after the current one ends. Default: true',
          },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { query, videoId, deviceName, radio } = input as {
          query?: string;
          videoId?: string;
          deviceName?: string;
          radio?: boolean;
        };

        if (!query && !videoId) {
          return 'Please provide either a search query or a videoId.';
        }

        try {
          // Resolve the track
          let track: MusicTrack | undefined;
          if (videoId) {
            // Search by videoId to get metadata
            const results = await searchSongs(videoId, 1);
            track = results[0];
            if (!track) {
              // Fall back to minimal track info
              track = {
                videoId,
                title: 'Unknown',
                artist: 'Unknown',
                album: undefined,
                durationSeconds: undefined,
                durationText: undefined,
                thumbnailUrl: undefined,
              };
            }
          } else {
            const results = await searchSongs(query!, 1);
            track = results[0];
            if (!track) {
              return `No results found for "${query}". Try a different search query.`;
            }
          }

          const device = resolveDevice(deviceName);
          return await playTrack(device, track, radio);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: play failed', { error: msg, query, videoId, deviceName });
          return `play failed: ${msg}`;
        }
      },
    },

    {
      name: 'pause',
      description: 'Pause the currently playing music on a Cast device.',
      schema: {
        type: 'object',
        properties: {
          deviceName: { type: 'string', description: 'Name of the Cast device. If omitted, uses the current device.' },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { deviceName } = input as { deviceName?: string };
        try {
          const device = resolveDevice(deviceName);
          return await pausePlayback(device);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: pause failed', { error: msg, deviceName });
          return `pause failed: ${msg}`;
        }
      },
    },

    {
      name: 'resume',
      description: 'Resume paused music on a Cast device.',
      schema: {
        type: 'object',
        properties: {
          deviceName: { type: 'string', description: 'Name of the Cast device. If omitted, uses the current device.' },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { deviceName } = input as { deviceName?: string };
        try {
          const device = resolveDevice(deviceName);
          return await resumePlayback(device);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: resume failed', { error: msg, deviceName });
          return `resume failed: ${msg}`;
        }
      },
    },

    {
      name: 'stop',
      description: 'Stop music playback and clear the queue on a Cast device.',
      schema: {
        type: 'object',
        properties: {
          deviceName: { type: 'string', description: 'Name of the Cast device. If omitted, uses the current device.' },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { deviceName } = input as { deviceName?: string };
        try {
          const device = resolveDevice(deviceName);
          return await stopPlayback(device);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: stop failed', { error: msg, deviceName });
          return `stop failed: ${msg}`;
        }
      },
    },

    {
      name: 'skip',
      description: 'Skip to the next song in the queue.',
      schema: {
        type: 'object',
        properties: {
          deviceName: { type: 'string', description: 'Name of the Cast device. If omitted, uses the current device.' },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { deviceName } = input as { deviceName?: string };
        try {
          const device = resolveDevice(deviceName);
          return await skipTrack(device);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: skip failed', { error: msg, deviceName });
          return `skip failed: ${msg}`;
        }
      },
    },

    {
      name: 'queue_add',
      description: 'Add a song to the playback queue. It will play after the current track and any other queued songs.',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query to find and queue a song' },
          videoId: { type: 'string', description: 'Specific YouTube Music video ID to queue' },
          deviceName: { type: 'string', description: 'Name of the Cast device. If omitted, uses the current device.' },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { query, videoId, deviceName } = input as {
          query?: string;
          videoId?: string;
          deviceName?: string;
        };

        if (!query && !videoId) {
          return 'Please provide either a search query or a videoId.';
        }

        try {
          let track: MusicTrack | undefined;
          if (videoId) {
            const results = await searchSongs(videoId, 1);
            track = results[0] ?? {
              videoId,
              title: 'Unknown',
              artist: 'Unknown',
              album: undefined,
              durationSeconds: undefined,
              durationText: undefined,
              thumbnailUrl: undefined,
            };
          } else {
            const results = await searchSongs(query!, 1);
            track = results[0];
            if (!track) {
              return `No results found for "${query}".`;
            }
          }

          const device = resolveDevice(deviceName);
          return await addToQueue(device, track);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: queue_add failed', { error: msg, query, videoId });
          return `queue_add failed: ${msg}`;
        }
      },
    },

    {
      name: 'queue_view',
      description: 'View the current playback queue including the currently playing song.',
      schema: {
        type: 'object',
        properties: {
          deviceName: { type: 'string', description: 'Name of the Cast device. If omitted, uses the current device.' },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { deviceName } = input as { deviceName?: string };
        try {
          const device = resolveDevice(deviceName);
          const state = getQueueState(device);

          if (!state) {
            return `No active session on "${device.name}".`;
          }

          return formatQueueState(state);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: queue_view failed', { error: msg, deviceName });
          return `queue_view failed: ${msg}`;
        }
      },
    },

    {
      name: 'set_volume',
      description: 'Set the volume on a Cast device. Level is 0 to 100 (percentage).',
      schema: {
        type: 'object',
        properties: {
          level: { type: 'number', description: 'Volume level from 0 to 100' },
          deviceName: { type: 'string', description: 'Name of the Cast device. If omitted, uses the current device.' },
        },
        required: ['level'],
      },
      handler: async (ctx, input) => {
        const { level, deviceName } = input as { level: number; deviceName?: string };
        try {
          const device = resolveDevice(deviceName);
          return await setVolume(device, level / 100); // Convert 0-100 to 0.0-1.0
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: set_volume failed', { error: msg, level, deviceName });
          return `set_volume failed: ${msg}`;
        }
      },
    },

    {
      name: 'list_devices',
      description: 'List all Cast devices (Chromecast, Google Home, Nest speakers) discovered on the local network.',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        const devices = listDevices();
        if (devices.length === 0) {
          return 'No Cast devices found on the network. Make sure devices are powered on and connected to the same network as the orchestrator.';
        }

        const lines = devices.map((d) => `- **${d.name}** (${d.model ?? 'unknown model'}) at ${d.host}:${d.port}`);
        return `Found ${devices.length} Cast device(s):\n\n${lines.join('\n')}`;
      },
    },

    {
      name: 'my_playlists',
      description: "List the user's YouTube Music playlists. Requires YouTube Music account to be connected.",
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (ctx) => {
        try {
          const settings = (await ctx.getSettings(settingsSchema)) as MusicSettings;
          const api = getAuthenticatedApi(settings);
          if (api) {
            const playlists = await api.getPlaylists();
            if (playlists.length === 0) {
              return 'No playlists found in your library.';
            }
            return formatPlaylists(playlists.map((p) => ({ title: p.title, id: p.playlistId })));
          }

          // Fallback to youtubei.js client (cookie auth)
          const client = getRawClient();
          if (!client) {
            return 'YouTube Music client not initialized.';
          }
          if (!client.session.logged_in) {
            return 'Not authenticated. Connect your YouTube Music account in the admin settings.';
          }

          const library = await client.music.getLibrary();
          const items = library?.contents ?? [];
          if (items.length === 0) {
            return 'No playlists found in your library.';
          }

          return formatPlaylists(
            (items as unknown as Record<string, unknown>[]).map((p) => ({
              title: String((p.title as { toString?: () => string })?.toString?.() ?? 'Untitled'),
              id: String(p.playlist_id ?? p.id ?? ''),
            })),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: my_playlists failed', { error: msg });
          return `Failed to fetch playlists: ${msg}`;
        }
      },
    },

    {
      name: 'liked_songs',
      description: "List the user's liked songs from YouTube Music. Requires account to be connected.",
      schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max songs to return (default: 20)' },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { limit } = input as { limit?: number };
        const maxItems = limit ?? 20;

        try {
          const settings = (await ctx.getSettings(settingsSchema)) as MusicSettings;
          const api = getAuthenticatedApi(settings);
          if (api) {
            const result = await api.getLikedSongs(maxItems);
            if (result.tracks.length === 0) {
              return 'No liked songs found.';
            }
            return formatLikedSongs(result.tracks.map((t) => ({ title: t.title, artist: t.artist, videoId: t.videoId })));
          }

          // Fallback to youtubei.js client (cookie auth)
          const client = getRawClient();
          if (!client) {
            return 'YouTube Music client not initialized.';
          }
          if (!client.session.logged_in) {
            return 'Not authenticated. Connect your YouTube Music account in the admin settings.';
          }

          const playlist = await client.music.getPlaylist('LM');
          const items = playlist?.contents ?? [];
          const tracks = items.slice(0, maxItems);

          if (tracks.length === 0) {
            return 'No liked songs found.';
          }

          return formatLikedSongs(
            (tracks as unknown as Record<string, unknown>[]).map((item) => ({
              title: String((item.title as { toString?: () => string })?.toString?.() ?? 'Unknown'),
              artist: String(((item.artists as Array<{ name: string }>) ?? [])[0]?.name ?? item.author ?? 'Unknown'),
              videoId: String((item.video_id as string) ?? (item.id as string) ?? ''),
            })),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: liked_songs failed', { error: msg });
          return `Failed to fetch liked songs: ${msg}`;
        }
      },
    },

    {
      name: 'like_song',
      description: 'Like a song on YouTube Music. Adds it to your Liked Music playlist. Requires account to be connected.',
      schema: {
        type: 'object',
        properties: {
          videoId: { type: 'string', description: 'YouTube Music video ID of the song to like' },
        },
        required: ['videoId'],
      },
      handler: async (ctx, input) => {
        const { videoId } = input as { videoId: string };
        try {
          const settings = (await ctx.getSettings(settingsSchema)) as MusicSettings;
          const api = getAuthenticatedApi(settings);
          if (!api) {
            return 'Not authenticated. Connect your YouTube Music account in the admin settings.';
          }
          await api.likeSong(videoId);
          return `Liked song (videoId: ${videoId}). It has been added to your Liked Music.`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: like_song failed', { error: msg, videoId });
          return `like_song failed: ${msg}`;
        }
      },
    },

    {
      name: 'unlike_song',
      description: 'Remove a like from a song on YouTube Music. Requires account to be connected.',
      schema: {
        type: 'object',
        properties: {
          videoId: { type: 'string', description: 'YouTube Music video ID of the song to unlike' },
        },
        required: ['videoId'],
      },
      handler: async (ctx, input) => {
        const { videoId } = input as { videoId: string };
        try {
          const settings = (await ctx.getSettings(settingsSchema)) as MusicSettings;
          const api = getAuthenticatedApi(settings);
          if (!api) {
            return 'Not authenticated. Connect your YouTube Music account in the admin settings.';
          }
          await api.unlikeSong(videoId);
          return `Removed like from song (videoId: ${videoId}).`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error('music: unlike_song failed', { error: msg, videoId });
          return `unlike_song failed: ${msg}`;
        }
      },
    },

    {
      name: 'get_playback_settings',
      description: 'Get current music playback settings (default volume, radio/autoplay, audio quality).',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (ctx) => {
        const settings = (await ctx.getSettings(settingsSchema)) as MusicSettings;
        const lines = [
          `**Default Volume:** ${settings.defaultVolume ?? 50}%`,
          `**Radio / Autoplay:** ${settings.radioEnabled !== false ? 'enabled' : 'disabled'}`,
          `**Audio Quality:** ${settings.audioQuality ?? 'auto'}`,
        ];
        return lines.join('\n');
      },
    },

    {
      name: 'update_playback_settings',
      description: 'Update music playback settings. Provide only the fields you want to change.',
      schema: {
        type: 'object',
        properties: {
          defaultVolume: { type: 'number', description: 'Default volume 0-100' },
          radioEnabled: { type: 'boolean', description: 'Enable radio/autoplay mode' },
          audioQuality: { type: 'string', description: 'Audio quality: "auto", "high", or "low"' },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { defaultVolume, radioEnabled, audioQuality } = input as {
          defaultVolume?: number;
          radioEnabled?: boolean;
          audioQuality?: string;
        };

        // Merge updates
        const updates: Record<string, unknown> = {};
        if (defaultVolume !== undefined) {
          updates.defaultVolume = Math.max(0, Math.min(100, defaultVolume));
        }
        if (radioEnabled !== undefined) {
          updates.radioEnabled = radioEnabled;
        }
        if (audioQuality !== undefined) {
          if (!['auto', 'high', 'low'].includes(audioQuality)) {
            return 'Invalid audio quality. Choose "auto", "high", or "low".';
          }
          updates.audioQuality = audioQuality;
        }

        await ctx.db.$transaction(async (tx) => {
          const existing = await tx.pluginConfig.findUnique({
            where: { pluginName: 'music' },
          });
          const currentSettings = (existing?.settings ?? {}) as Record<string, unknown>;

          await tx.pluginConfig.upsert({
            where: { pluginName: 'music' },
            create: { pluginName: 'music', enabled: true, settings: { ...currentSettings, ...updates } as Record<string, unknown> as never },
            update: { settings: { ...currentSettings, ...updates } as Record<string, unknown> as never },
          });
        });

        await ctx.notifySettingsChange('music');

        const parts: string[] = [];
        if (updates.defaultVolume !== undefined) {
          parts.push(`Default volume: ${updates.defaultVolume}%`);
        }
        if (updates.radioEnabled !== undefined) {
          parts.push(`Radio: ${updates.radioEnabled ? 'enabled' : 'disabled'}`);
        }
        if (updates.audioQuality !== undefined) {
          parts.push(`Audio quality: ${updates.audioQuality}`);
        }
        return `Settings updated: ${parts.join(', ')}`;
      },
    },
  ],

  start: async (ctx) => {
    ctx.logger.info('music: Loading settings...');
    const settings = await loadAndApplySettings(ctx);

    ctx.logger.info('music: Initializing YouTube Music client...');
    await initClientWithSettings(ctx, settings);

    ctx.logger.info('music: Starting Cast device discovery...');
    startDiscovery();

    initPlaybackController(ctx.logger, {
      defaultVolume: settings.defaultVolume,
      radioEnabled: settings.radioEnabled,
      audioQuality: settings.audioQuality,
    });
    ctx.logger.info('music: Plugin started successfully.');
  },

  stop: async (ctx) => {
    ctx.logger.info('music: Shutting down...');
    destroyPlaybackController();
    stopDiscovery();
    destroyYouTubeMusicClient();
    ctx.logger.info('music: Plugin stopped.');
  },

  register: async (ctx) => ({
    onSettingsChange: async (pluginName: string) => {
      if (pluginName !== 'music') {
        return;
      }

      ctx.logger.info('music: Settings changed, reloading...');
      const settings = await loadAndApplySettings(ctx);

      // Reinitialize client with new credentials
      await initClientWithSettings(ctx, settings);
    },
  }),
};

export { musicPlugin };
