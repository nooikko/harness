import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { musicPlugin } from '../index';

const textOf = (r: ToolResult): string => (typeof r === 'string' ? r : r.text);

// Mock all helpers
vi.mock('../_helpers/youtube-music-client', () => ({
  initYouTubeMusicClient: vi.fn().mockResolvedValue(undefined),
  replaceYouTubeMusicClient: vi.fn().mockResolvedValue(undefined),
  destroyYouTubeMusicClient: vi.fn(),
  getRawClient: vi.fn().mockReturnValue(null),
  searchSongs: vi.fn().mockResolvedValue([
    {
      videoId: 'v1',
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      durationSeconds: 200,
      durationText: '3:20',
      thumbnailUrl: 'https://thumb.jpg',
    },
  ]),
}));

vi.mock('../_helpers/cast-device-manager', () => ({
  startDiscovery: vi.fn(),
  stopDiscovery: vi.fn(),
  updateDeviceAliases: vi.fn(),
  updateActiveSessionIds: vi.fn(),
  listDevices: vi.fn().mockReturnValue([{ name: 'Living Room', host: '192.168.1.100', port: 8009, id: 'lr', model: 'Google Home' }]),
  resolveDevice: vi.fn().mockReturnValue({
    name: 'Living Room',
    host: '192.168.1.100',
    port: 8009,
    id: 'lr',
    model: 'Google Home',
  }),
}));

vi.mock('../_helpers/playback-controller', () => ({
  initPlaybackController: vi.fn(),
  destroyPlaybackController: vi.fn(),
  updatePlaybackSettings: vi.fn(),
  getActiveSessionIds: vi.fn().mockReturnValue(new Set()),
  identifyDevice: vi.fn().mockResolvedValue('Played chime'),
  playTrack: vi.fn().mockResolvedValue('Now playing: Test Song by Test Artist on Living Room'),
  pausePlayback: vi.fn().mockResolvedValue('Paused on Living Room.'),
  resumePlayback: vi.fn().mockResolvedValue('Resumed on Living Room.'),
  stopPlayback: vi.fn().mockResolvedValue('Stopped playback and cleared queue on Living Room.'),
  skipTrack: vi.fn().mockResolvedValue('Now playing: Next Song by Next Artist'),
  setVolume: vi.fn().mockResolvedValue('Volume set to 50% on Living Room.'),
  addToQueue: vi.fn().mockReturnValue('Added "Test Song" by Test Artist to queue. Queue length: 1'),
  getQueueState: vi.fn().mockReturnValue({
    device: { name: 'Living Room' },
    currentTrack: { title: 'Test Song', artist: 'Test Artist' },
    queue: [],
    radioEnabled: true,
    playerState: 'PLAYING',
  }),
}));

vi.mock('../_helpers/format-search-results', () => ({
  formatSearchResults: vi.fn().mockReturnValue('Found 1 result(s):\n\n1. **Test Song** by Test Artist'),
}));

vi.mock('../_helpers/settings-schema', () => ({
  settingsSchema: {
    toFieldArray: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../_helpers/device-alias-manager', () => ({
  getDeviceAliases: vi.fn().mockReturnValue({}),
}));

vi.mock('../_helpers/oauth-routes', () => ({
  createOAuthRoutes: vi.fn().mockReturnValue([]),
}));

vi.mock('../_helpers/device-routes', () => ({
  createDeviceRoutes: vi.fn().mockReturnValue([]),
}));

const createMockContext = (): PluginContext => {
  const pluginConfig = {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({}),
  };
  return {
    db: {
      pluginConfig,
      $transaction: vi.fn((cb: (tx: { pluginConfig: typeof pluginConfig }) => Promise<unknown>) => cb({ pluginConfig })),
    },
    invoker: { invoke: vi.fn() },
    config: {} as never,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    sendToThread: vi.fn(),
    broadcast: vi.fn(),
    getSettings: vi.fn(),
    notifySettingsChange: vi.fn(),
    reportStatus: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
  } as unknown as PluginContext;
};

describe('music plugin', () => {
  it('has correct name and version', () => {
    expect(musicPlugin.name).toBe('music');
    expect(musicPlugin.version).toBe('1.0.0');
  });

  it('registers with onSettingsChange hook', async () => {
    const ctx = createMockContext();
    const hooks = await musicPlugin.register(ctx);
    expect(hooks.onSettingsChange).toBeDefined();
  });

  it('exposes 14 MCP tools', () => {
    expect(musicPlugin.tools).toHaveLength(14);
    const toolNames = musicPlugin.tools!.map((t) => t.name);
    expect(toolNames).toEqual([
      'search',
      'play',
      'pause',
      'resume',
      'stop',
      'skip',
      'queue_add',
      'queue_view',
      'set_volume',
      'list_devices',
      'my_playlists',
      'liked_songs',
      'get_playback_settings',
      'update_playback_settings',
    ]);
  });

  it('has start and stop lifecycle methods', () => {
    expect(musicPlugin.start).toBeDefined();
    expect(musicPlugin.stop).toBeDefined();
  });

  describe('tool: search', () => {
    it('searches YouTube Music', async () => {
      const ctx = createMockContext();
      const tool = musicPlugin.tools!.find((t) => t.name === 'search')!;
      const result = await tool.handler(ctx, { query: 'bohemian rhapsody' }, { threadId: 't1', traceId: 'tr1' });
      expect(result).toContain('Found 1 result(s)');
    });
  });

  describe('tool: play', () => {
    it('plays a song by query', async () => {
      const ctx = createMockContext();
      const tool = musicPlugin.tools!.find((t) => t.name === 'play')!;
      const result = await tool.handler(ctx, { query: 'test song' }, { threadId: 't1', traceId: 'tr1' });
      expect(result).toContain('Now playing');
    });

    it('returns error when no query or videoId', async () => {
      const ctx = createMockContext();
      const tool = musicPlugin.tools!.find((t) => t.name === 'play')!;
      const result = await tool.handler(ctx, {}, { threadId: 't1', traceId: 'tr1' });
      expect(result).toContain('Please provide');
    });
  });

  describe('tool: list_devices', () => {
    it('lists discovered devices', async () => {
      const ctx = createMockContext();
      const tool = musicPlugin.tools!.find((t) => t.name === 'list_devices')!;
      const result = await tool.handler(ctx, {}, { threadId: 't1', traceId: 'tr1' });
      expect(result).toContain('Living Room');
      expect(result).toContain('Google Home');
    });
  });

  describe('tool: queue_view', () => {
    it('shows current playback state', async () => {
      const ctx = createMockContext();
      const tool = musicPlugin.tools!.find((t) => t.name === 'queue_view')!;
      const result = await tool.handler(ctx, {}, { threadId: 't1', traceId: 'tr1' });
      const text = textOf(result);
      expect(text).toContain('Living Room');
      expect(text).toContain('PLAYING');
      expect(text).toContain('Test Song');
    });
  });

  describe('tool: set_volume', () => {
    it('converts percentage to 0-1 range', async () => {
      const { setVolume } = await import('../_helpers/playback-controller');
      const ctx = createMockContext();
      const tool = musicPlugin.tools!.find((t) => t.name === 'set_volume')!;
      await tool.handler(ctx, { level: 50 }, { threadId: 't1', traceId: 'tr1' });
      expect(vi.mocked(setVolume)).toHaveBeenCalledWith(expect.anything(), 0.5);
    });
  });

  describe('lifecycle', () => {
    it('initializes on start', async () => {
      const ctx = createMockContext();
      (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({});
      await musicPlugin.start!(ctx);
      expect(ctx.logger.info).toHaveBeenCalledWith('music: Plugin started successfully.');
    });

    it('cleans up on stop', async () => {
      const ctx = createMockContext();
      await musicPlugin.stop!(ctx);
      expect(ctx.logger.info).toHaveBeenCalledWith('music: Plugin stopped.');
    });
  });

  describe('tool: play (branches)', () => {
    const meta = { threadId: 't1', traceId: 'tr1' };

    const getTool = () => musicPlugin.tools!.find((t) => t.name === 'play')!;

    it('plays by videoId when search returns a match', async () => {
      const { searchSongs } = await import('../_helpers/youtube-music-client');
      const mockSearch = vi.mocked(searchSongs);
      mockSearch.mockResolvedValueOnce([
        {
          videoId: 'abc123',
          title: 'Found Song',
          artist: 'Found Artist',
          album: 'A',
          durationSeconds: 180,
          durationText: '3:00',
          thumbnailUrl: undefined,
        },
      ]);

      const { playTrack } = await import('../_helpers/playback-controller');
      vi.mocked(playTrack).mockResolvedValueOnce('Now playing: Found Song by Found Artist');

      const result = await getTool().handler(createMockContext(), { videoId: 'abc123' }, meta);
      expect(mockSearch).toHaveBeenCalledWith('abc123', 1);
      expect(result).toContain('Now playing');
    });

    it('falls back to minimal track info when videoId search returns nothing', async () => {
      const { searchSongs } = await import('../_helpers/youtube-music-client');
      vi.mocked(searchSongs).mockResolvedValueOnce([]);

      const { playTrack } = await import('../_helpers/playback-controller');
      vi.mocked(playTrack).mockResolvedValueOnce('Now playing: Unknown by Unknown');

      const result = await getTool().handler(createMockContext(), { videoId: 'missing123' }, meta);
      expect(vi.mocked(playTrack)).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ videoId: 'missing123', title: 'Unknown', artist: 'Unknown' }),
        undefined,
      );
      expect(result).toContain('Now playing');
    });

    it('returns not-found message when query search returns no results', async () => {
      const { searchSongs } = await import('../_helpers/youtube-music-client');
      vi.mocked(searchSongs).mockResolvedValueOnce([]);

      const result = await getTool().handler(createMockContext(), { query: 'nonexistent song' }, meta);
      expect(result).toBe('No results found for "nonexistent song". Try a different search query.');
    });

    it('passes radio=false when explicitly set', async () => {
      const { playTrack } = await import('../_helpers/playback-controller');
      vi.mocked(playTrack).mockResolvedValueOnce('Now playing: Test Song');

      await getTool().handler(createMockContext(), { query: 'test', radio: false }, meta);
      expect(vi.mocked(playTrack)).toHaveBeenCalledWith(expect.anything(), expect.anything(), false);
    });

    it('defaults radio to undefined when omitted (uses settings default)', async () => {
      const { playTrack } = await import('../_helpers/playback-controller');
      vi.mocked(playTrack).mockResolvedValueOnce('Now playing: Test Song');

      await getTool().handler(createMockContext(), { query: 'test' }, meta);
      expect(vi.mocked(playTrack)).toHaveBeenCalledWith(expect.anything(), expect.anything(), undefined);
    });
  });

  describe('tool: queue_add (branches)', () => {
    const meta = { threadId: 't1', traceId: 'tr1' };

    const getTool = () => musicPlugin.tools!.find((t) => t.name === 'queue_add')!;

    it('returns error when no query or videoId', async () => {
      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toBe('Please provide either a search query or a videoId.');
    });

    it('queues by videoId when search returns a match', async () => {
      const { searchSongs } = await import('../_helpers/youtube-music-client');
      vi.mocked(searchSongs).mockResolvedValueOnce([
        {
          videoId: 'q1',
          title: 'Queue Song',
          artist: 'Queue Artist',
          album: 'QA',
          durationSeconds: 200,
          durationText: '3:20',
          thumbnailUrl: undefined,
        },
      ]);

      const { addToQueue } = await import('../_helpers/playback-controller');
      vi.mocked(addToQueue).mockReturnValueOnce('Added "Queue Song" by Queue Artist to queue.');

      const result = await getTool().handler(createMockContext(), { videoId: 'q1' }, meta);
      expect(result).toContain('Added');
    });

    it('uses fallback track when videoId search returns nothing', async () => {
      const { searchSongs } = await import('../_helpers/youtube-music-client');
      vi.mocked(searchSongs).mockResolvedValueOnce([]);

      const { addToQueue } = await import('../_helpers/playback-controller');
      vi.mocked(addToQueue).mockReturnValueOnce('Added "Unknown" to queue.');

      await getTool().handler(createMockContext(), { videoId: 'unknown-vid' }, meta);
      expect(vi.mocked(addToQueue)).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ videoId: 'unknown-vid', title: 'Unknown', artist: 'Unknown' }),
      );
    });

    it('returns not-found message when query search returns no results', async () => {
      const { searchSongs } = await import('../_helpers/youtube-music-client');
      vi.mocked(searchSongs).mockResolvedValueOnce([]);

      const result = await getTool().handler(createMockContext(), { query: 'no results here' }, meta);
      expect(result).toBe('No results found for "no results here".');
    });

    it('queues by query when search returns results', async () => {
      const { addToQueue } = await import('../_helpers/playback-controller');
      vi.mocked(addToQueue).mockReturnValueOnce('Added "Test Song" to queue.');

      const result = await getTool().handler(createMockContext(), { query: 'test song' }, meta);
      expect(result).toContain('Added');
    });
  });

  describe('tool: queue_view (branches)', () => {
    const meta = { threadId: 't1', traceId: 'tr1' };

    const getTool = () => musicPlugin.tools!.find((t) => t.name === 'queue_view')!;

    it('returns no-session message when getQueueState returns null', async () => {
      const { getQueueState } = await import('../_helpers/playback-controller');
      vi.mocked(getQueueState).mockReturnValueOnce(null);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toContain('No active session');
    });

    it('shows (nothing) when currentTrack is null', async () => {
      const { getQueueState } = await import('../_helpers/playback-controller');
      vi.mocked(getQueueState).mockReturnValueOnce({
        device: { name: 'Kitchen' } as never,
        currentTrack: null,
        queue: [],
        radioEnabled: false,
        playerState: 'IDLE',
      });

      const result = await getTool().handler(createMockContext(), {}, meta);
      const text = textOf(result);
      expect(text).toContain('**Now Playing:** (nothing)');
      expect(text).toContain('**Radio:** off');
    });

    it('lists queued tracks when queue is non-empty', async () => {
      const { getQueueState } = await import('../_helpers/playback-controller');
      vi.mocked(getQueueState).mockReturnValueOnce({
        device: { name: 'Living Room' } as never,
        currentTrack: { title: 'Current', artist: 'Artist A' } as never,
        queue: [{ title: 'Next One', artist: 'Artist B' } as never, { title: 'After That', artist: 'Artist C' } as never],
        radioEnabled: true,
        playerState: 'PLAYING',
      });

      const result = await getTool().handler(createMockContext(), {}, meta);
      const text = textOf(result);
      expect(text).toContain('**Up Next (2):**');
      expect(text).toContain('1. Next One by Artist B');
      expect(text).toContain('2. After That by Artist C');
    });

    it('shows (empty) when queue has no tracks', async () => {
      const { getQueueState } = await import('../_helpers/playback-controller');
      vi.mocked(getQueueState).mockReturnValueOnce({
        device: { name: 'Living Room' } as never,
        currentTrack: { title: 'Solo', artist: 'Alone' } as never,
        queue: [],
        radioEnabled: true,
        playerState: 'PLAYING',
      });

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(textOf(result)).toContain('**Up Next:** (empty)');
    });
  });

  describe('tool: list_devices (branches)', () => {
    const meta = { threadId: 't1', traceId: 'tr1' };

    const getTool = () => musicPlugin.tools!.find((t) => t.name === 'list_devices')!;

    it('returns no-devices message when none found', async () => {
      const { listDevices: listDevicesMock } = await import('../_helpers/cast-device-manager');
      vi.mocked(listDevicesMock).mockReturnValueOnce([]);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toContain('No Cast devices found');
    });

    it('handles device with no model', async () => {
      const { listDevices: listDevicesMock } = await import('../_helpers/cast-device-manager');
      vi.mocked(listDevicesMock).mockReturnValueOnce([{ name: 'Mystery Device', host: '10.0.0.5', port: 8009, id: 'md', model: undefined }]);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toContain('unknown model');
      expect(result).toContain('Mystery Device');
    });
  });

  describe('tool: search (branches)', () => {
    const meta = { threadId: 't1', traceId: 'tr1' };

    it('passes custom limit to searchSongs', async () => {
      const { searchSongs } = await import('../_helpers/youtube-music-client');
      const tool = musicPlugin.tools!.find((t) => t.name === 'search')!;

      await tool.handler(createMockContext(), { query: 'test', limit: 10 }, meta);
      expect(vi.mocked(searchSongs)).toHaveBeenCalledWith('test', 10);
    });

    it('defaults limit to 5 when omitted', async () => {
      const { searchSongs } = await import('../_helpers/youtube-music-client');
      vi.mocked(searchSongs).mockClear();
      const tool = musicPlugin.tools!.find((t) => t.name === 'search')!;

      await tool.handler(createMockContext(), { query: 'default limit' }, meta);
      expect(vi.mocked(searchSongs)).toHaveBeenCalledWith('default limit', 5);
    });
  });

  describe('tool: pause', () => {
    it('resolves device and delegates to pausePlayback', async () => {
      const { pausePlayback } = await import('../_helpers/playback-controller');
      const { resolveDevice: resolveDeviceMock } = await import('../_helpers/cast-device-manager');
      const tool = musicPlugin.tools!.find((t) => t.name === 'pause')!;

      await tool.handler(createMockContext(), { deviceName: 'Kitchen' }, { threadId: 't1', traceId: 'tr1' });
      expect(vi.mocked(resolveDeviceMock)).toHaveBeenCalledWith('Kitchen');
      expect(vi.mocked(pausePlayback)).toHaveBeenCalledWith(expect.objectContaining({ name: 'Living Room' }));
    });

    it('passes undefined when no deviceName', async () => {
      const { resolveDevice: resolveDeviceMock } = await import('../_helpers/cast-device-manager');
      const tool = musicPlugin.tools!.find((t) => t.name === 'pause')!;

      await tool.handler(createMockContext(), {}, { threadId: 't1', traceId: 'tr1' });
      expect(vi.mocked(resolveDeviceMock)).toHaveBeenCalledWith(undefined);
    });
  });

  describe('tool: resume', () => {
    it('resolves device and delegates to resumePlayback', async () => {
      const { resumePlayback } = await import('../_helpers/playback-controller');
      const { resolveDevice: resolveDeviceMock } = await import('../_helpers/cast-device-manager');
      const tool = musicPlugin.tools!.find((t) => t.name === 'resume')!;

      await tool.handler(createMockContext(), { deviceName: 'Bedroom' }, { threadId: 't1', traceId: 'tr1' });
      expect(vi.mocked(resolveDeviceMock)).toHaveBeenCalledWith('Bedroom');
      expect(vi.mocked(resumePlayback)).toHaveBeenCalledWith(expect.objectContaining({ name: 'Living Room' }));
    });
  });

  describe('tool: stop', () => {
    it('resolves device and delegates to stopPlayback', async () => {
      const { stopPlayback } = await import('../_helpers/playback-controller');
      const { resolveDevice: resolveDeviceMock } = await import('../_helpers/cast-device-manager');
      const tool = musicPlugin.tools!.find((t) => t.name === 'stop')!;

      await tool.handler(createMockContext(), { deviceName: 'Office' }, { threadId: 't1', traceId: 'tr1' });
      expect(vi.mocked(resolveDeviceMock)).toHaveBeenCalledWith('Office');
      expect(vi.mocked(stopPlayback)).toHaveBeenCalledWith(expect.objectContaining({ name: 'Living Room' }));
    });
  });

  describe('tool: skip', () => {
    it('resolves device and delegates to skipTrack', async () => {
      const { skipTrack } = await import('../_helpers/playback-controller');
      const { resolveDevice: resolveDeviceMock } = await import('../_helpers/cast-device-manager');
      const tool = musicPlugin.tools!.find((t) => t.name === 'skip')!;

      await tool.handler(createMockContext(), { deviceName: 'Garage' }, { threadId: 't1', traceId: 'tr1' });
      expect(vi.mocked(resolveDeviceMock)).toHaveBeenCalledWith('Garage');
      expect(vi.mocked(skipTrack)).toHaveBeenCalledWith(expect.objectContaining({ name: 'Living Room' }));
    });
  });

  describe('tool: set_volume (branches)', () => {
    it('passes deviceName to resolveDevice', async () => {
      const { resolveDevice: resolveDeviceMock } = await import('../_helpers/cast-device-manager');
      const { setVolume } = await import('../_helpers/playback-controller');
      vi.mocked(setVolume).mockResolvedValueOnce('Volume set to 75%');

      const tool = musicPlugin.tools!.find((t) => t.name === 'set_volume')!;
      await tool.handler(createMockContext(), { level: 75, deviceName: 'Bedroom' }, { threadId: 't1', traceId: 'tr1' });

      expect(vi.mocked(resolveDeviceMock)).toHaveBeenCalledWith('Bedroom');
      expect(vi.mocked(setVolume)).toHaveBeenCalledWith(expect.anything(), 0.75);
    });
  });

  describe('tool: my_playlists', () => {
    const meta = { threadId: 't1', traceId: 'tr1' };
    const getTool = () => musicPlugin.tools!.find((t) => t.name === 'my_playlists')!;

    it('returns error when client is null', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce(null);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toBe('YouTube Music client not initialized.');
    });

    it('returns error when not logged in', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: false },
        music: { getLibrary: vi.fn(), getPlaylist: vi.fn() },
      } as never);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toContain('Not authenticated');
    });

    it('returns playlists when authenticated', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: true },
        music: {
          getLibrary: vi.fn().mockResolvedValue({
            contents: [
              { title: { toString: () => 'My Playlist' }, playlist_id: 'pl1' },
              { title: { toString: () => 'Workout Mix' }, id: 'pl2' },
            ],
          }),
          getPlaylist: vi.fn(),
        },
      } as never);

      const result = await getTool().handler(createMockContext(), {}, meta);
      const text = textOf(result);
      expect(text).toContain('Your playlists:');
      expect(text).toContain('My Playlist');
      expect(text).toContain('Workout Mix');
      expect(text).toContain('pl1');
    });

    it('returns message when no playlists found', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: true },
        music: {
          getLibrary: vi.fn().mockResolvedValue({ contents: [] }),
          getPlaylist: vi.fn(),
        },
      } as never);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toBe('No playlists found in your library.');
    });

    it('returns message when library contents is null', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: true },
        music: {
          getLibrary: vi.fn().mockResolvedValue({ contents: null }),
          getPlaylist: vi.fn(),
        },
      } as never);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toBe('No playlists found in your library.');
    });

    it('returns error message on exception', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: true },
        music: {
          getLibrary: vi.fn().mockRejectedValue(new Error('API error')),
          getPlaylist: vi.fn(),
        },
      } as never);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toContain('Failed to fetch playlists');
      expect(result).toContain('API error');
    });

    it('handles playlist entry with no title toString', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: true },
        music: {
          getLibrary: vi.fn().mockResolvedValue({
            contents: [{ title: null, playlist_id: 'p1' }],
          }),
          getPlaylist: vi.fn(),
        },
      } as never);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(textOf(result)).toContain('Untitled');
    });
  });

  describe('tool: liked_songs', () => {
    const meta = { threadId: 't1', traceId: 'tr1' };
    const getTool = () => musicPlugin.tools!.find((t) => t.name === 'liked_songs')!;

    it('returns error when client is null', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce(null);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toBe('YouTube Music client not initialized.');
    });

    it('returns error when not logged in', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: false },
        music: { getLibrary: vi.fn(), getPlaylist: vi.fn() },
      } as never);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toContain('Not authenticated');
    });

    it('returns liked songs when authenticated', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: true },
        music: {
          getLibrary: vi.fn(),
          getPlaylist: vi.fn().mockResolvedValue({
            contents: [
              { title: { toString: () => 'Song A' }, artists: [{ name: 'Artist A' }], video_id: 'va' },
              { title: { toString: () => 'Song B' }, artists: [{ name: 'Artist B' }], id: 'vb' },
            ],
          }),
        },
      } as never);

      const result = await getTool().handler(createMockContext(), {}, meta);
      const text = textOf(result);
      expect(text).toContain('Liked songs (2)');
      expect(text).toContain('Song A');
      expect(text).toContain('Artist A');
      expect(text).toContain('va');
    });

    it('respects custom limit', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      const items = Array.from({ length: 30 }, (_, i) => ({
        title: { toString: () => `Song ${i}` },
        artists: [{ name: `Artist ${i}` }],
        video_id: `v${i}`,
      }));
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: true },
        music: {
          getLibrary: vi.fn(),
          getPlaylist: vi.fn().mockResolvedValue({ contents: items }),
        },
      } as never);

      const result = await getTool().handler(createMockContext(), { limit: 3 }, meta);
      expect(textOf(result)).toContain('Liked songs (3)');
    });

    it('returns message when no liked songs', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: true },
        music: {
          getLibrary: vi.fn(),
          getPlaylist: vi.fn().mockResolvedValue({ contents: [] }),
        },
      } as never);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toBe('No liked songs found.');
    });

    it('returns message when contents is null', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: true },
        music: {
          getLibrary: vi.fn(),
          getPlaylist: vi.fn().mockResolvedValue({ contents: null }),
        },
      } as never);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toBe('No liked songs found.');
    });

    it('returns error message on exception', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: true },
        music: {
          getLibrary: vi.fn(),
          getPlaylist: vi.fn().mockRejectedValue(new Error('Network failure')),
        },
      } as never);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(result).toContain('Failed to fetch liked songs');
      expect(result).toContain('Network failure');
    });

    it('handles item with author fallback when no artists array', async () => {
      const { getRawClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(getRawClient).mockReturnValueOnce({
        session: { logged_in: true },
        music: {
          getLibrary: vi.fn(),
          getPlaylist: vi.fn().mockResolvedValue({
            contents: [{ title: { toString: () => 'Track' }, author: 'Fallback Author', video_id: 'v1' }],
          }),
        },
      } as never);

      const result = await getTool().handler(createMockContext(), {}, meta);
      expect(textOf(result)).toContain('Fallback Author');
    });
  });

  describe('tool: get_playback_settings', () => {
    const meta = { threadId: 't1', traceId: 'tr1' };
    const getTool = () => musicPlugin.tools!.find((t) => t.name === 'get_playback_settings')!;

    it('returns current settings with defaults', async () => {
      const ctx = createMockContext();
      (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await getTool().handler(ctx, {}, meta);
      expect(result).toContain('**Default Volume:** 50%');
      expect(result).toContain('**Radio / Autoplay:** enabled');
      expect(result).toContain('**Audio Quality:** auto');
    });

    it('returns custom settings when configured', async () => {
      const ctx = createMockContext();
      (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        defaultVolume: 75,
        radioEnabled: false,
        audioQuality: 'high',
      });

      const result = await getTool().handler(ctx, {}, meta);
      expect(result).toContain('**Default Volume:** 75%');
      expect(result).toContain('**Radio / Autoplay:** disabled');
      expect(result).toContain('**Audio Quality:** high');
    });
  });

  describe('tool: update_playback_settings', () => {
    const meta = { threadId: 't1', traceId: 'tr1' };
    const getTool = () => musicPlugin.tools!.find((t) => t.name === 'update_playback_settings')!;

    it('updates volume and notifies settings change', async () => {
      const ctx = createMockContext();
      const pc = {
        findUnique: vi.fn().mockResolvedValue({ settings: {} }),
        upsert: vi.fn().mockResolvedValue({}),
      };
      (ctx.db as unknown as Record<string, unknown>).pluginConfig = pc;
      (ctx.db as unknown as Record<string, unknown>).$transaction = vi.fn((cb: (tx: { pluginConfig: typeof pc }) => Promise<unknown>) =>
        cb({ pluginConfig: pc }),
      );

      const result = await getTool().handler(ctx, { defaultVolume: 80 }, meta);
      expect(result).toContain('Settings updated');
      expect(result).toContain('Default volume: 80%');
      expect(ctx.notifySettingsChange).toHaveBeenCalledWith('music');
    });

    it('updates radio setting', async () => {
      const ctx = createMockContext();
      const pc = {
        findUnique: vi.fn().mockResolvedValue({ settings: { defaultVolume: 50 } }),
        upsert: vi.fn().mockResolvedValue({}),
      };
      (ctx.db as unknown as Record<string, unknown>).pluginConfig = pc;
      (ctx.db as unknown as Record<string, unknown>).$transaction = vi.fn((cb: (tx: { pluginConfig: typeof pc }) => Promise<unknown>) =>
        cb({ pluginConfig: pc }),
      );

      const result = await getTool().handler(ctx, { radioEnabled: false }, meta);
      expect(result).toContain('Radio: disabled');
    });

    it('updates audio quality', async () => {
      const ctx = createMockContext();
      const pc = {
        findUnique: vi.fn().mockResolvedValue({ settings: {} }),
        upsert: vi.fn().mockResolvedValue({}),
      };
      (ctx.db as unknown as Record<string, unknown>).pluginConfig = pc;
      (ctx.db as unknown as Record<string, unknown>).$transaction = vi.fn((cb: (tx: { pluginConfig: typeof pc }) => Promise<unknown>) =>
        cb({ pluginConfig: pc }),
      );

      const result = await getTool().handler(ctx, { audioQuality: 'high' }, meta);
      expect(result).toContain('Audio quality: high');
    });

    it('rejects invalid audio quality', async () => {
      const ctx = createMockContext();

      const result = await getTool().handler(ctx, { audioQuality: 'ultra' }, meta);
      expect(result).toContain('Invalid audio quality');
    });

    it('clamps volume to 0-100 range', async () => {
      const ctx = createMockContext();
      const upsertMock = vi.fn().mockResolvedValue({});
      const pc = {
        findUnique: vi.fn().mockResolvedValue({ settings: {} }),
        upsert: upsertMock,
      };
      (ctx.db as unknown as Record<string, unknown>).pluginConfig = pc;
      (ctx.db as unknown as Record<string, unknown>).$transaction = vi.fn((cb: (tx: { pluginConfig: typeof pc }) => Promise<unknown>) =>
        cb({ pluginConfig: pc }),
      );

      await getTool().handler(ctx, { defaultVolume: 150 }, meta);
      const upsertCall = upsertMock.mock.calls[0]?.[0] as Record<string, Record<string, unknown>>;
      const settings = upsertCall?.update?.settings as Record<string, unknown>;
      expect(settings?.defaultVolume).toBe(100);
    });

    it('merges with existing settings', async () => {
      const ctx = createMockContext();
      const upsertMock = vi.fn().mockResolvedValue({});
      const pc = {
        findUnique: vi.fn().mockResolvedValue({ settings: { defaultVolume: 60, radioEnabled: true } }),
        upsert: upsertMock,
      };
      (ctx.db as unknown as Record<string, unknown>).pluginConfig = pc;
      (ctx.db as unknown as Record<string, unknown>).$transaction = vi.fn((cb: (tx: { pluginConfig: typeof pc }) => Promise<unknown>) =>
        cb({ pluginConfig: pc }),
      );

      await getTool().handler(ctx, { audioQuality: 'low' }, meta);
      const upsertCall = upsertMock.mock.calls[0]?.[0] as Record<string, Record<string, unknown>>;
      const settings = upsertCall?.update?.settings as Record<string, unknown>;
      // Existing settings should be preserved
      expect(settings?.defaultVolume).toBe(60);
      expect(settings?.radioEnabled).toBe(true);
      expect(settings?.audioQuality).toBe('low');
    });

    it('handles null existing config', async () => {
      const ctx = createMockContext();

      const result = await getTool().handler(ctx, { defaultVolume: 50 }, meta);
      expect(result).toContain('Default volume: 50%');
    });

    it('updates multiple settings at once', async () => {
      const ctx = createMockContext();
      const pc = {
        findUnique: vi.fn().mockResolvedValue({ settings: {} }),
        upsert: vi.fn().mockResolvedValue({}),
      };
      (ctx.db as unknown as Record<string, unknown>).pluginConfig = pc;
      (ctx.db as unknown as Record<string, unknown>).$transaction = vi.fn((cb: (tx: { pluginConfig: typeof pc }) => Promise<unknown>) =>
        cb({ pluginConfig: pc }),
      );

      const result = await getTool().handler(ctx, { defaultVolume: 70, radioEnabled: true, audioQuality: 'auto' }, meta);
      expect(result).toContain('Default volume: 70%');
      expect(result).toContain('Radio: enabled');
      expect(result).toContain('Audio quality: auto');
    });
  });

  describe('onSettingsChange hook', () => {
    it('ignores settings changes for other plugins', async () => {
      const ctx = createMockContext();
      (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({});
      const hooks = await musicPlugin.register(ctx);

      const { replaceYouTubeMusicClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(replaceYouTubeMusicClient).mockClear();

      await hooks.onSettingsChange!('discord');
      expect(vi.mocked(replaceYouTubeMusicClient)).not.toHaveBeenCalled();
    });

    it('reloads settings and reinitializes client for music plugin', async () => {
      const ctx = createMockContext();
      (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({ cookie: 'new-cookie' });
      const hooks = await musicPlugin.register(ctx);

      const { replaceYouTubeMusicClient } = await import('../_helpers/youtube-music-client');
      const { updatePlaybackSettings } = await import('../_helpers/playback-controller');
      vi.mocked(replaceYouTubeMusicClient).mockClear();
      vi.mocked(updatePlaybackSettings).mockClear();

      await hooks.onSettingsChange!('music');

      expect(vi.mocked(replaceYouTubeMusicClient)).toHaveBeenCalledWith(expect.objectContaining({ cookie: 'new-cookie' }));
      expect(vi.mocked(updatePlaybackSettings)).toHaveBeenCalled();
      expect(ctx.logger.info).toHaveBeenCalledWith('music: Settings changed, reloading...');
    });
  });

  describe('start lifecycle with settings', () => {
    it('loads settings and passes them to playback controller and client', async () => {
      const ctx = createMockContext();
      (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        defaultVolume: 65,
        radioEnabled: false,
        audioQuality: 'high',
        cookie: 'my-cookie',
      });

      const { initPlaybackController } = await import('../_helpers/playback-controller');
      const { replaceYouTubeMusicClient } = await import('../_helpers/youtube-music-client');
      vi.mocked(initPlaybackController).mockClear();
      vi.mocked(replaceYouTubeMusicClient).mockClear();

      await musicPlugin.start!(ctx);

      expect(vi.mocked(initPlaybackController)).toHaveBeenCalledWith(ctx.logger, {
        defaultVolume: 65,
        radioEnabled: false,
        audioQuality: 'high',
      });
      expect(vi.mocked(replaceYouTubeMusicClient)).toHaveBeenCalledWith(expect.objectContaining({ cookie: 'my-cookie' }));
    });

    it('logs authentication mode based on credentials', async () => {
      const ctx = createMockContext();
      (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        youtubeAuth: { accessToken: 'token', refreshToken: 'refresh' },
      });

      await musicPlugin.start!(ctx);
      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('(authenticated)'));
    });

    it('logs cookie auth mode', async () => {
      const ctx = createMockContext();
      (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        cookie: 'some-cookie',
      });

      await musicPlugin.start!(ctx);
      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('(cookie auth)'));
    });

    it('logs anonymous mode when no auth', async () => {
      const ctx = createMockContext();
      (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await musicPlugin.start!(ctx);
      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('(anonymous)'));
    });
  });

  describe('plugin structure', () => {
    it('has settingsSchema', () => {
      expect(musicPlugin.settingsSchema).toBeDefined();
    });

    it('has routes array', () => {
      expect(musicPlugin.routes).toBeDefined();
      expect(Array.isArray(musicPlugin.routes)).toBe(true);
    });
  });
});
