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
});
