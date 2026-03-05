import type { PluginDefinition } from '@harness/plugin-contract';
import { listDevices, resolveDevice, startDiscovery, stopDiscovery } from './_helpers/cast-device-manager';
import { formatSearchResults } from './_helpers/format-search-results';
import {
  addToQueue,
  destroyPlaybackController,
  getQueueState,
  initPlaybackController,
  pausePlayback,
  playTrack,
  resumePlayback,
  setVolume,
  skipTrack,
  stopPlayback,
} from './_helpers/playback-controller';
import type { MusicTrack } from './_helpers/youtube-music-client';
import { destroyYouTubeMusicClient, initYouTubeMusicClient, searchSongs } from './_helpers/youtube-music-client';

const musicPlugin: PluginDefinition = {
  name: 'music',
  version: '1.0.0',

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
      handler: async (_ctx, input) => {
        const { query, limit } = input as { query: string; limit?: number };
        const results = await searchSongs(query, limit ?? 5);
        return formatSearchResults(results);
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
      handler: async (_ctx, input) => {
        const { query, videoId, deviceName, radio } = input as {
          query?: string;
          videoId?: string;
          deviceName?: string;
          radio?: boolean;
        };

        if (!query && !videoId) {
          return 'Please provide either a search query or a videoId.';
        }

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
        return playTrack(device, track, radio ?? true);
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
      handler: async (_ctx, input) => {
        const { deviceName } = input as { deviceName?: string };
        const device = resolveDevice(deviceName);
        return pausePlayback(device);
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
      handler: async (_ctx, input) => {
        const { deviceName } = input as { deviceName?: string };
        const device = resolveDevice(deviceName);
        return resumePlayback(device);
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
      handler: async (_ctx, input) => {
        const { deviceName } = input as { deviceName?: string };
        const device = resolveDevice(deviceName);
        return stopPlayback(device);
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
      handler: async (_ctx, input) => {
        const { deviceName } = input as { deviceName?: string };
        const device = resolveDevice(deviceName);
        return skipTrack(device);
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
      handler: async (_ctx, input) => {
        const { query, videoId, deviceName } = input as {
          query?: string;
          videoId?: string;
          deviceName?: string;
        };

        if (!query && !videoId) {
          return 'Please provide either a search query or a videoId.';
        }

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
        return addToQueue(device, track);
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
      handler: async (_ctx, input) => {
        const { deviceName } = input as { deviceName?: string };
        const device = resolveDevice(deviceName);
        const state = getQueueState(device);

        if (!state) {
          return `No active session on "${device.name}".`;
        }

        const lines: string[] = [];
        lines.push(`**Device:** ${state.device.name}`);
        lines.push(`**State:** ${state.playerState}`);
        lines.push(`**Radio:** ${state.radioEnabled ? 'on' : 'off'}`);

        if (state.currentTrack) {
          lines.push(`\n**Now Playing:** ${state.currentTrack.title} by ${state.currentTrack.artist}`);
        } else {
          lines.push('\n**Now Playing:** (nothing)');
        }

        if (state.queue.length > 0) {
          lines.push(`\n**Up Next (${state.queue.length}):**`);
          for (const [i, t] of state.queue.entries()) {
            lines.push(`  ${i + 1}. ${t.title} by ${t.artist}`);
          }
        } else {
          lines.push('\n**Up Next:** (empty)');
        }

        return lines.join('\n');
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
      handler: async (_ctx, input) => {
        const { level, deviceName } = input as { level: number; deviceName?: string };
        const device = resolveDevice(deviceName);
        return setVolume(device, level / 100); // Convert 0-100 to 0.0-1.0
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
  ],

  start: async (ctx) => {
    ctx.logger.info('music: Initializing YouTube Music client...');
    await initYouTubeMusicClient();

    ctx.logger.info('music: Starting Cast device discovery...');
    startDiscovery();

    initPlaybackController(ctx.logger);
    ctx.logger.info('music: Plugin started successfully.');
  },

  stop: async (ctx) => {
    ctx.logger.info('music: Shutting down...');
    destroyPlaybackController();
    stopDiscovery();
    destroyYouTubeMusicClient();
    ctx.logger.info('music: Plugin stopped.');
  },

  register: async (_ctx) => ({}),
};

export { musicPlugin };
