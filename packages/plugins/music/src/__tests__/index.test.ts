import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { musicPlugin } from '../index';

// Mock all helpers
vi.mock('../_helpers/youtube-music-client', () => ({
  initYouTubeMusicClient: vi.fn().mockResolvedValue(undefined),
  destroyYouTubeMusicClient: vi.fn(),
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

const createMockContext = (): PluginContext =>
  ({
    db: {} as never,
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
  }) as unknown as PluginContext;

describe('music plugin', () => {
  it('has correct name and version', () => {
    expect(musicPlugin.name).toBe('music');
    expect(musicPlugin.version).toBe('1.0.0');
  });

  it('registers with no hooks', async () => {
    const ctx = createMockContext();
    const hooks = await musicPlugin.register(ctx);
    expect(Object.keys(hooks)).toHaveLength(0);
  });

  it('exposes 10 MCP tools', () => {
    expect(musicPlugin.tools).toHaveLength(10);
    const toolNames = musicPlugin.tools!.map((t) => t.name);
    expect(toolNames).toEqual(['search', 'play', 'pause', 'resume', 'stop', 'skip', 'queue_add', 'queue_view', 'set_volume', 'list_devices']);
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
      expect(result).toContain('Living Room');
      expect(result).toContain('PLAYING');
      expect(result).toContain('Test Song');
    });
  });

  describe('tool: set_volume', () => {
    it('converts percentage to 0-1 range', async () => {
      const ctx = createMockContext();
      const tool = musicPlugin.tools!.find((t) => t.name === 'set_volume')!;
      const result = await tool.handler(ctx, { level: 50 }, { threadId: 't1', traceId: 'tr1' });
      expect(result).toContain('50%');
    });
  });

  describe('lifecycle', () => {
    it('initializes on start', async () => {
      const ctx = createMockContext();
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
        true,
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

    it('defaults radio to true when omitted', async () => {
      const { playTrack } = await import('../_helpers/playback-controller');
      vi.mocked(playTrack).mockResolvedValueOnce('Now playing: Test Song');

      await getTool().handler(createMockContext(), { query: 'test' }, meta);
      expect(vi.mocked(playTrack)).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
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
      expect(result).toContain('**Now Playing:** (nothing)');
      expect(result).toContain('**Radio:** off');
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
      expect(result).toContain('**Up Next (2):**');
      expect(result).toContain('1. Next One by Artist B');
      expect(result).toContain('2. After That by Artist C');
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
      expect(result).toContain('**Up Next:** (empty)');
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
    it('delegates to pausePlayback', async () => {
      const { pausePlayback } = await import('../_helpers/playback-controller');
      const tool = musicPlugin.tools!.find((t) => t.name === 'pause')!;

      const result = await tool.handler(createMockContext(), {}, { threadId: 't1', traceId: 'tr1' });
      expect(vi.mocked(pausePlayback)).toHaveBeenCalled();
      expect(result).toContain('Paused');
    });
  });

  describe('tool: resume', () => {
    it('delegates to resumePlayback', async () => {
      const { resumePlayback } = await import('../_helpers/playback-controller');
      const tool = musicPlugin.tools!.find((t) => t.name === 'resume')!;

      const result = await tool.handler(createMockContext(), {}, { threadId: 't1', traceId: 'tr1' });
      expect(vi.mocked(resumePlayback)).toHaveBeenCalled();
      expect(result).toContain('Resumed');
    });
  });

  describe('tool: stop', () => {
    it('delegates to stopPlayback', async () => {
      const { stopPlayback } = await import('../_helpers/playback-controller');
      const tool = musicPlugin.tools!.find((t) => t.name === 'stop')!;

      const result = await tool.handler(createMockContext(), {}, { threadId: 't1', traceId: 'tr1' });
      expect(vi.mocked(stopPlayback)).toHaveBeenCalled();
      expect(result).toContain('Stopped');
    });
  });

  describe('tool: skip', () => {
    it('delegates to skipTrack', async () => {
      const { skipTrack } = await import('../_helpers/playback-controller');
      const tool = musicPlugin.tools!.find((t) => t.name === 'skip')!;

      const result = await tool.handler(createMockContext(), {}, { threadId: 't1', traceId: 'tr1' });
      expect(vi.mocked(skipTrack)).toHaveBeenCalled();
      expect(result).toContain('Now playing');
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
});
