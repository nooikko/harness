import { describe, expect, it, vi } from 'vitest';

// Mock settings-schema to avoid @harness/plugin-contract resolution
vi.mock('../_helpers/settings-schema', () => ({
  settingsSchema: { fields: {}, __brand: 'settings-schema' },
}));

vi.mock('@harness/cast-devices', () => ({
  startDiscovery: vi.fn(),
  stopDiscovery: vi.fn(),
  listDevices: vi.fn(() => [
    {
      name: 'Living Room',
      host: '192.168.1.10',
      port: 8009,
      id: 'lr1',
      model: 'Google Home',
    },
  ]),
  resolveDevice: vi.fn(() => ({
    name: 'Living Room',
    host: '192.168.1.10',
    port: 8009,
    id: 'lr1',
    model: 'Google Home',
  })),
}));

vi.mock('../_helpers/audio-server', () => ({
  createAudioServer: vi.fn(() => ({
    start: vi.fn(async () => ({ host: '192.168.1.50', port: 9849 })),
    stop: vi.fn(async () => {}),
    register: vi.fn(() => 'http://192.168.1.50:9849/audio/test.mp3'),
  })),
}));

vi.mock('../_helpers/tts-provider', () => ({
  createTtsProvider: vi.fn(() => ({
    name: 'edge-tts',
    generate: vi.fn(async () => Buffer.from('audio-data')),
    listVoices: vi.fn(async () => ['en-US-GuyNeural']),
  })),
}));

vi.mock('../_helpers/cast-announcer', () => ({
  announce: vi.fn(async () => {}),
}));

const { plugin } = await import('../index');

describe('notifications plugin', () => {
  it('has the correct name and version', () => {
    expect(plugin.name).toBe('notifications');
    expect(plugin.version).toBe('1.0.0');
  });

  it('exposes 2 MCP tools', () => {
    expect(plugin.tools).toHaveLength(2);
    const toolNames = plugin.tools?.map((t) => t.name) ?? [];
    expect(toolNames).toContain('announce');
    expect(toolNames).toContain('list_speakers');
  });

  it('has a settings schema', () => {
    expect(plugin.settingsSchema).toBeDefined();
  });

  it('has start and stop lifecycle methods', () => {
    expect(plugin.start).toBeDefined();
    expect(plugin.stop).toBeDefined();
  });

  it('register returns onBroadcast and onSettingsChange hooks', async () => {
    const mockCtx = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      getSettings: vi.fn(async () => ({
        ttsProvider: 'edge-tts',
        voice: 'en-US-GuyNeural',
        volume: 70,
        defaultDevice: '',
        audioServerPort: 9849,
      })),
    };

    const hooks = await plugin.register(mockCtx as never);
    expect(hooks.onBroadcast).toBeDefined();
    expect(hooks.onSettingsChange).toBeDefined();
  });

  describe('settings defaults for empty strings', () => {
    it('uses default voice when getSettings returns empty string', async () => {
      const mockGenerate = vi.fn(async () => Buffer.from('audio-data'));
      const { createTtsProvider } = await import('../_helpers/tts-provider');
      (createTtsProvider as ReturnType<typeof vi.fn>).mockReturnValue({
        name: 'edge-tts',
        generate: mockGenerate,
        listVoices: vi.fn(async () => []),
      });

      const mockCtx = {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        getSettings: vi.fn(async () => ({
          ttsProvider: 'edge-tts',
          voice: '',
          volume: 70,
          defaultDevice: '__auto__',
        })),
      };

      // Register with empty voice — should default, not pass ''
      await plugin.register(mockCtx as never);

      // Start the plugin to initialize ttsProvider and audioServer
      await plugin.start!(mockCtx as never);

      // Trigger announce tool
      const announceTool = plugin.tools?.find((t) => t.name === 'announce');
      await announceTool?.handler(mockCtx as never, { message: 'test' }, { threadId: 't1' });

      // The voice passed to generate() must NOT be empty string
      expect(mockGenerate).toHaveBeenCalledTimes(1);
      const voiceArg = (mockGenerate.mock.calls as unknown[][])[0]![1];
      expect(voiceArg).not.toBe('');
      expect(voiceArg).toBeTruthy();
    });

    it('uses default voice when onSettingsChange returns empty string', async () => {
      const mockGenerate = vi.fn(async () => Buffer.from('audio-data'));
      const { createTtsProvider } = await import('../_helpers/tts-provider');
      (createTtsProvider as ReturnType<typeof vi.fn>).mockReturnValue({
        name: 'edge-tts',
        generate: mockGenerate,
        listVoices: vi.fn(async () => []),
      });

      const mockCtx = {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        getSettings: vi.fn(async () => ({
          ttsProvider: 'edge-tts',
          voice: 'en-US-GuyNeural',
          volume: 70,
          defaultDevice: '',
        })),
      };

      // Register with valid settings first
      const hooks = await plugin.register(mockCtx as never);
      await plugin.start!(mockCtx as never);

      // Now simulate settings change returning empty voice
      (mockCtx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        ttsProvider: 'edge-tts',
        voice: '',
        volume: 50,
        defaultDevice: '__auto__',
      });
      await hooks.onSettingsChange!('notifications');

      // Trigger announce tool
      const announceTool = plugin.tools?.find((t) => t.name === 'announce');
      await announceTool?.handler(mockCtx as never, { message: 'test' }, { threadId: 't1' });

      // Voice must not be empty
      expect(mockGenerate).toHaveBeenCalled();
      const voiceArg = (mockGenerate.mock.calls as unknown[][])[0]![1];
      expect(voiceArg).not.toBe('');
      expect(voiceArg).toBeTruthy();
    });
  });

  describe('announce tool', () => {
    it('has required schema fields', () => {
      const announceTool = plugin.tools?.find((t) => t.name === 'announce');
      expect(announceTool).toBeDefined();
      expect(announceTool?.schema.properties).toHaveProperty('message');
      expect(announceTool?.schema.required).toContain('message');
    });

    it('has optional device and volume fields', () => {
      const announceTool = plugin.tools?.find((t) => t.name === 'announce');
      const props = announceTool?.schema.properties as Record<string, unknown>;
      expect(props).toHaveProperty('device');
      expect(props).toHaveProperty('volume');
    });
  });

  describe('list_speakers tool', () => {
    it('has no required fields', () => {
      const tool = plugin.tools?.find((t) => t.name === 'list_speakers');
      expect(tool).toBeDefined();
      expect(tool?.schema.required).toBeUndefined();
    });
  });
});
