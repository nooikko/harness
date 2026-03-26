import type { PluginContext } from '@harness/plugin-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

// Mock the vector-search module so we don't load the real ONNX model
vi.mock('@harness/vector-search', () => ({
  embed: vi.fn(),
  embedSingle: vi.fn(),
}));

// Import the mocked functions so we can control their behavior per test
const { embed, embedSingle } = await import('@harness/vector-search');

const createMockContext = (overrides: Partial<PluginContext> = {}): PluginContext =>
  ({
    db: {} as never,
    invoker: { invoke: vi.fn() },
    config: {
      claudeModel: 'sonnet',
      databaseUrl: '',
      timezone: 'America/Phoenix',
      maxConcurrentAgents: 5,
      claudeTimeout: 30000,
      discordToken: undefined,
      discordChannelId: undefined,
      port: 3001,
      logLevel: 'info',
      uploadDir: '/tmp/uploads',
    } as never,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    sendToThread: vi.fn(),
    broadcast: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({}),
    notifySettingsChange: vi.fn().mockResolvedValue(undefined),
    reportStatus: vi.fn(),
    reportBackgroundError: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
    executeTool: vi.fn().mockResolvedValue('Tool executed successfully'),
    ...overrides,
  }) as PluginContext;

// Create fake embeddings for intent definitions. We need enough vectors
// for all example utterances across all intent definitions (4 intents, ~39 examples total).
// Each intent gets a distinct "direction" in a 4-dim space so cosine similarity works.
const LIGHTS_CONTROL_VEC = [0.9, 0.1, 0.05, 0.05];
const LIGHTS_TOGGLE_VEC = [0.8, 0.15, 0.1, 0.05];
const MUSIC_PLAY_VEC = [0.05, 0.9, 0.1, 0.05];
const MUSIC_CONTROL_VEC = [0.05, 0.1, 0.9, 0.05];

const makeFakeEmbeddings = (): number[][] => {
  // Must match the exact count of examples in INTENT_DEFINITIONS
  // lights.control: 22, lights.toggle: 5, music.play: 13, music.control: 10
  return [
    ...Array.from<number[]>({ length: 22 }).fill(LIGHTS_CONTROL_VEC),
    ...Array.from<number[]>({ length: 5 }).fill(LIGHTS_TOGGLE_VEC),
    ...Array.from<number[]>({ length: 13 }).fill(MUSIC_PLAY_VEC),
    ...Array.from<number[]>({ length: 10 }).fill(MUSIC_CONTROL_VEC),
  ];
};

describe('intent plugin', () => {
  afterEach(async () => {
    // Reset module-level state between tests
    await plugin.stop?.({} as PluginContext);
    vi.clearAllMocks();
  });

  it('exports a valid PluginDefinition', () => {
    expect(plugin.name).toBe('intent');
    expect(plugin.version).toBe('1.0.0');
    expect(typeof plugin.register).toBe('function');
    expect(typeof plugin.start).toBe('function');
    expect(typeof plugin.stop).toBe('function');
  });

  it('register returns onIntentClassify hook', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);
    expect(typeof hooks.onIntentClassify).toBe('function');
  });

  describe('onIntentClassify hook — guard clauses', () => {
    it('returns handled: false before start() is called (registry not built)', async () => {
      const ctx = createMockContext();
      const hooks = await plugin.register(ctx);

      const result = await hooks.onIntentClassify!('thread-1', 'turn on the office lights');
      expect(result.handled).toBe(false);
    });

    it('returns handled: false when executeTool is not available', async () => {
      const ctx = createMockContext({ executeTool: undefined });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onIntentClassify!('thread-1', 'turn on the lights');
      expect(result.handled).toBe(false);
    });
  });

  describe('start()', () => {
    it('builds the intent registry using embed', async () => {
      vi.mocked(embed).mockResolvedValueOnce(makeFakeEmbeddings());
      const ctx = createMockContext();
      await plugin.register(ctx);
      await plugin.start!(ctx);

      expect(embed).toHaveBeenCalledOnce();
      // Should have been called with all example utterances flattened
      const callArgs = vi.mocked(embed).mock.calls[0]?.[0] as string[];
      expect(callArgs.length).toBe(50); // 22 + 5 + 13 + 10
      expect(callArgs[0]).toBe('turn on the office lights');
    });

    it('reports degraded status when embed fails', async () => {
      vi.mocked(embed).mockRejectedValueOnce(new Error('ONNX model load failed'));
      const ctx = createMockContext();
      await plugin.register(ctx);
      await plugin.start!(ctx);

      expect(ctx.reportStatus).toHaveBeenCalledWith('degraded', 'Intent registry failed to build');
    });
  });

  describe('onIntentClassify — full integration flow', () => {
    let ctx: PluginContext;
    let hooks: Awaited<ReturnType<typeof plugin.register>>;

    beforeEach(async () => {
      vi.mocked(embed).mockResolvedValueOnce(makeFakeEmbeddings());
      ctx = createMockContext();
      hooks = await plugin.register(ctx);
      await plugin.start!(ctx);
    });

    it('fast-paths a lights control request', async () => {
      // embedSingle returns a vector close to lights.control
      vi.mocked(embedSingle).mockResolvedValueOnce(LIGHTS_CONTROL_VEC);
      vi.mocked(ctx.executeTool!).mockResolvedValueOnce('Office lights turned on');

      const result = await hooks.onIntentClassify!('thread-1', 'turn on the office lights');

      expect(result.handled).toBe(true);
      expect(result.response).toBe('Office lights turned on');
      expect(ctx.executeTool).toHaveBeenCalledWith('govee__set_light', expect.objectContaining({ device: 'office', on: true }), {
        threadId: 'thread-1',
      });
    });

    it('fast-paths a music play request', async () => {
      vi.mocked(embedSingle).mockResolvedValueOnce(MUSIC_PLAY_VEC);
      vi.mocked(ctx.executeTool!).mockResolvedValueOnce('Now playing: jazz');

      const result = await hooks.onIntentClassify!('thread-1', 'play some jazz');

      expect(result.handled).toBe(true);
      expect(result.response).toBe('Now playing: jazz');
      expect(ctx.executeTool).toHaveBeenCalledWith('music__play', expect.objectContaining({ query: 'jazz' }), { threadId: 'thread-1' });
    });

    it('fast-paths a music control request (pause)', async () => {
      vi.mocked(embedSingle).mockResolvedValueOnce(MUSIC_CONTROL_VEC);
      vi.mocked(ctx.executeTool!).mockResolvedValueOnce('Music paused');

      const result = await hooks.onIntentClassify!('thread-1', 'pause the music');

      expect(result.handled).toBe(true);
      expect(result.response).toBe('Music paused');
      expect(ctx.executeTool).toHaveBeenCalledWith('music__pause', {}, { threadId: 'thread-1' });
    });

    it('handles compound requests — lights + music in parallel', async () => {
      // Two parts: "turn on the office lights" and "play jazz"
      vi.mocked(embedSingle).mockResolvedValueOnce(LIGHTS_CONTROL_VEC).mockResolvedValueOnce(MUSIC_PLAY_VEC);

      vi.mocked(ctx.executeTool!).mockResolvedValueOnce('Office lights on').mockResolvedValueOnce('Playing jazz');

      const result = await hooks.onIntentClassify!('thread-1', 'turn on the office lights and play jazz');

      expect(result.handled).toBe(true);
      expect(result.response).toBe('Office lights on\n\nPlaying jazz');
      expect(ctx.executeTool).toHaveBeenCalledTimes(2);
    });

    it('falls through to LLM for low-confidence classification', async () => {
      // Return a vector equidistant from all intents → low confidence
      vi.mocked(embedSingle).mockResolvedValueOnce([0.25, 0.25, 0.25, 0.25]);

      const result = await hooks.onIntentClassify!('thread-1', 'what is the weather like today?');

      expect(result.handled).toBe(false);
      expect(ctx.executeTool).not.toHaveBeenCalled();
    });

    it('falls through to LLM when compound request has one low-confidence part', async () => {
      vi.mocked(embedSingle)
        .mockResolvedValueOnce(LIGHTS_CONTROL_VEC) // high confidence
        .mockResolvedValueOnce([0.25, 0.25, 0.25, 0.25]); // low confidence

      const result = await hooks.onIntentClassify!('thread-1', 'turn on the lights and do something weird');

      expect(result.handled).toBe(false);
    });

    it('falls through to LLM when tool execution fails', async () => {
      vi.mocked(embedSingle).mockResolvedValueOnce(LIGHTS_CONTROL_VEC);
      vi.mocked(ctx.executeTool!).mockRejectedValueOnce(new Error('Govee API timeout'));

      const result = await hooks.onIntentClassify!('thread-1', 'turn on the office lights');

      expect(result.handled).toBe(false);
    });

    it('handles ToolResult object (not just string)', async () => {
      vi.mocked(embedSingle).mockResolvedValueOnce(LIGHTS_CONTROL_VEC);
      vi.mocked(ctx.executeTool!).mockResolvedValueOnce({ text: 'Lights on', blocks: [] });

      const result = await hooks.onIntentClassify!('thread-1', 'turn on the office lights');

      expect(result.handled).toBe(true);
      expect(result.response).toBe('Lights on');
    });

    it('resolves music control actions to correct tool names', async () => {
      vi.mocked(embedSingle).mockResolvedValueOnce(MUSIC_CONTROL_VEC);
      vi.mocked(ctx.executeTool!).mockResolvedValueOnce('Skipped');

      await hooks.onIntentClassify!('thread-1', 'skip this song');

      expect(ctx.executeTool).toHaveBeenCalledWith('music__skip', {}, { threadId: 'thread-1' });
    });

    it('passes color and brightness slots to govee tool', async () => {
      vi.mocked(embedSingle).mockResolvedValueOnce(LIGHTS_CONTROL_VEC);
      vi.mocked(ctx.executeTool!).mockResolvedValueOnce('Office lights set to red');

      await hooks.onIntentClassify!('thread-1', 'set the office lights to red');

      expect(ctx.executeTool).toHaveBeenCalledWith('govee__set_light', expect.objectContaining({ device: 'office', on: true, color: 'red' }), {
        threadId: 'thread-1',
      });
    });
  });

  describe('stop()', () => {
    it('clears registry so subsequent calls return handled: false', async () => {
      vi.mocked(embed).mockResolvedValueOnce(makeFakeEmbeddings());
      const ctx = createMockContext();
      const hooks = await plugin.register(ctx);
      await plugin.start!(ctx);

      await plugin.stop!(ctx);

      vi.mocked(embedSingle).mockResolvedValueOnce(LIGHTS_CONTROL_VEC);
      const result = await hooks.onIntentClassify!('thread-1', 'turn on the lights');
      expect(result.handled).toBe(false);
    });
  });
});
