import type { PluginContext, PluginDefinition } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSendDiscordReply } = vi.hoisted(() => ({
  mockSendDiscordReply: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_helpers/send-discord-reply', () => ({
  sendDiscordReply: mockSendDiscordReply,
}));

// Mock discord.js at the module level -- vi.mock is hoisted, so all references
// must be defined inside the factory or use vi.hoisted().
const { mockOn, mockOnce, mockLogin, mockDestroy, mockFetchChannel } = vi.hoisted(() => ({
  mockOn: vi.fn(),
  mockOnce: vi.fn(),
  mockLogin: vi.fn(),
  mockDestroy: vi.fn(),
  mockFetchChannel: vi.fn(),
}));

vi.mock('discord.js', () => {
  class MockClient {
    on = mockOn;
    once = mockOnce;
    login = mockLogin;
    destroy = mockDestroy;
    channels = { fetch: mockFetchChannel };
    user = { id: 'bot-123', tag: 'HarnessBot#1234' };
    isReady = vi.fn().mockReturnValue(true);
  }

  return {
    Client: MockClient,
    Events: {
      ClientReady: 'ready',
      Error: 'error',
      Warn: 'warn',
      MessageCreate: 'messageCreate',
      ShardDisconnect: 'shardDisconnect',
      ShardReconnecting: 'shardReconnecting',
      ShardResume: 'shardResume',
    },
    GatewayIntentBits: {
      Guilds: 1,
      GuildMessages: 2,
      MessageContent: 4,
      DirectMessages: 8,
    },
  };
});

// Helper to find an event handler registered on a mock
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FindHandler = <T>(mock: ReturnType<typeof vi.fn>, eventName: string) => T | undefined;

const findHandler: FindHandler = <T>(mock: ReturnType<typeof vi.fn>, eventName: string) => {
  // mock.calls is any[][] -- each element is [eventName, handler, ...]
  const calls = mock.mock.calls as unknown[][];
  const found = calls.find((c) => c[0] === eventName);
  return found ? (found[1] as T) : undefined;
};

// Helper to get all event names from a mock
type GetEventNames = (mock: ReturnType<typeof vi.fn>) => string[];

const getEventNames: GetEventNames = (mock) => {
  const calls = mock.mock.calls as unknown[][];
  return calls.map((c) => String(c[0]));
};

const createMockContext = (overrides: Partial<PluginContext['config']> = {}): PluginContext =>
  ({
    db: {
      thread: {
        upsert: vi.fn().mockResolvedValue({ id: 'thread-1' }),
      },
      message: {
        create: vi.fn(),
      },
      agent: {
        findFirst: vi.fn().mockResolvedValue({ id: 'default-agent-id' }),
      },
      pluginConfig: {
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PluginContext['db'],
    invoker: { invoke: vi.fn() },
    config: {
      databaseUrl: 'postgres://localhost:5432/test',
      timezone: 'America/Phoenix',
      maxConcurrentAgents: 3,
      claudeModel: 'sonnet',
      claudeTimeout: 300000,
      discordToken: undefined,
      discordChannelId: undefined,
      port: 3001,
      logLevel: 'info',
      uploadDir: '/tmp/uploads',
      ...overrides,
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    sendToThread: vi.fn().mockResolvedValue(undefined),
    broadcast: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({}),
    notifySettingsChange: vi.fn().mockResolvedValue(undefined),
    reportStatus: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
  }) as unknown as PluginContext;

// Module-level let variables for dynamic re-import (Phase 1: test isolation)
let plugin: PluginDefinition;
let splitMessage: (content: string) => string[];

describe('discord plugin', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    // Re-import to get fresh module-level state (resolvedToken, allowedChannels, defaultAgentId)
    const mod = await import('../index');
    plugin = mod.plugin;
    splitMessage = mod.splitMessage;
  });

  describe('plugin definition', () => {
    it('has required plugin metadata', () => {
      expect(plugin.name).toBe('discord');
      expect(plugin.version).toBe('1.0.0');
      expect(typeof plugin.register).toBe('function');
      expect(typeof plugin.start).toBe('function');
      expect(typeof plugin.stop).toBe('function');
    });

    it('exports settingsSchema on the definition', () => {
      expect(plugin.settingsSchema).toBeDefined();
      expect(typeof plugin.settingsSchema?.toFieldArray).toBe('function');
    });

    it('register returns onBroadcast and onSettingsChange hooks', async () => {
      const ctx = createMockContext();
      const hooks = await plugin.register(ctx);

      expect(hooks.onBroadcast).toBeTypeOf('function');
      expect(hooks.onSettingsChange).toBeTypeOf('function');
      // Discord plugin should NOT implement pipeline hooks
      expect(hooks.onBeforeInvoke).toBeUndefined();
      expect(hooks.onAfterInvoke).toBeUndefined();
      expect(hooks.onMessage).toBeUndefined();
    });

    it('register calls ctx.getSettings and returns onSettingsChange hook', async () => {
      const ctx = createMockContext();
      const hooks = await plugin.register(ctx);
      expect(ctx.getSettings).toHaveBeenCalledWith(expect.objectContaining({ toFieldArray: expect.any(Function) }));
      expect(typeof hooks.onSettingsChange).toBe('function');
    });
  });

  describe('start', () => {
    it('logs warning and skips connection when no token', async () => {
      const ctx = createMockContext();

      await plugin.start?.(ctx);

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('DISCORD_TOKEN not set'));
    });

    it('creates client and logs in when token is provided', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start?.(ctx);

      expect(mockLogin).toHaveBeenCalledWith('test-token');
      expect(mockOn).toHaveBeenCalled();
      expect(mockOnce).toHaveBeenCalled();
    });

    it('uses botToken from settings over ctx.config.discordToken', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'env-token' });
      (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        botToken: 'settings-token',
      });

      await plugin.register(ctx);
      await plugin.start?.(ctx);

      expect(mockLogin).toHaveBeenCalledWith('settings-token');
    });

    it('falls back to ctx.config.discordToken when settings has no botToken', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'fallback-token' });
      (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await plugin.register(ctx);
      await plugin.start?.(ctx);

      expect(mockLogin).toHaveBeenCalledWith('fallback-token');
    });

    it('registers event handlers on the client', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start?.(ctx);

      const onEvents = getEventNames(mockOn);
      const onceEvents = getEventNames(mockOnce);

      expect(onceEvents).toContain('ready');
      expect(onEvents).toContain('error');
      expect(onEvents).toContain('warn');
      expect(onEvents).toContain('shardDisconnect');
      expect(onEvents).toContain('shardReconnecting');
      expect(onEvents).toContain('shardResume');
      expect(onEvents).toContain('messageCreate');
    });

    it('handles login failure gracefully', async () => {
      mockLogin.mockRejectedValue(new Error('Invalid token'));
      const ctx = createMockContext({ discordToken: 'bad-token' });

      await plugin.start?.(ctx);

      expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('failed to connect'));
    });

    it('handles login failure with non-Error value', async () => {
      mockLogin.mockRejectedValue('token-rejected');
      const ctx = createMockContext({ discordToken: 'bad-token' });

      await plugin.start?.(ctx);

      expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('token-rejected'));
      expect(ctx.reportStatus).toHaveBeenCalledWith('error', expect.stringContaining('token-rejected'));
    });

    it('fires ClientReady handler to set connected state', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start?.(ctx);

      type ReadyHandler = (readyClient: { user: { tag: string } }) => void;
      const handler = findHandler<ReadyHandler>(mockOnce, 'ready');
      expect(handler).toBeDefined();

      handler?.({ user: { tag: 'HarnessBot#1234' } });

      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('connected as HarnessBot#1234'));
    });

    it('fires ShardDisconnect handler', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start?.(ctx);

      type DisconnectHandler = () => void;
      const handler = findHandler<DisconnectHandler>(mockOn, 'shardDisconnect');
      expect(handler).toBeDefined();

      handler?.();

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('disconnected from gateway'));
    });

    it('fires ShardReconnecting handler', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start?.(ctx);

      type ReconnectingHandler = () => void;
      const handler = findHandler<ReconnectingHandler>(mockOn, 'shardReconnecting');
      expect(handler).toBeDefined();

      handler?.();

      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('reconnecting to gateway'));
    });

    it('fires ShardResume handler', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start?.(ctx);

      type ResumeHandler = () => void;
      const handler = findHandler<ResumeHandler>(mockOn, 'shardResume');
      expect(handler).toBeDefined();

      handler?.();

      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('reconnected to gateway'));
    });

    it('fires Error handler on client error', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start?.(ctx);

      type ErrorHandler = (err: Error) => void;
      const handler = findHandler<ErrorHandler>(mockOn, 'error');
      expect(handler).toBeDefined();

      handler?.(new Error('WebSocket error'));

      expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('WebSocket error'));
    });

    it('fires Warn handler on client warning', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start?.(ctx);

      type WarnHandler = (msg: string) => void;
      const handler = findHandler<WarnHandler>(mockOn, 'warn');
      expect(handler).toBeDefined();

      handler?.('Rate limited');

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Rate limited'));
    });

    it('processes a valid message through the pipeline', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, 'messageCreate');
      expect(handler).toBeDefined();

      const mockMessage = {
        author: {
          bot: false,
          id: 'user-1',
          username: 'test',
          displayName: 'Test',
        },
        mentions: { users: new Map([['bot-123', {}]]) },
        guild: { id: 'guild-1' },
        content: '<@bot-123> hello',
        channel: {
          id: 'chan-1',
          name: 'general',
          isThread: () => false,
        },
      };

      await handler?.(mockMessage);

      expect(ctx.db.thread.upsert as ReturnType<typeof vi.fn>).toHaveBeenCalled();
      expect(ctx.db.message.create as ReturnType<typeof vi.fn>).toHaveBeenCalled();
      expect(ctx.broadcast).toHaveBeenCalledWith('discord:message', expect.any(Object));
      expect(ctx.sendToThread).toHaveBeenCalledWith('thread-1', 'hello');
    });

    it('includes default agentId when creating a new thread', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });
      (ctx.db.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'agent-abc',
      });

      await plugin.register(ctx);
      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, 'messageCreate');

      const mockMessage = {
        author: {
          bot: false,
          id: 'user-1',
          username: 'test',
          displayName: 'Test',
        },
        mentions: { users: new Map([['bot-123', {}]]) },
        guild: { id: 'guild-1' },
        content: '<@bot-123> hello',
        channel: { id: 'chan-1', name: 'general', isThread: () => false },
      };

      await handler?.(mockMessage);

      expect(ctx.db.thread.upsert as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            agent: { connect: { id: 'agent-abc' } },
          }),
        }),
      );
    });

    it('creates thread without agentId when no default agent exists', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });
      (ctx.db.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await plugin.register(ctx);
      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, 'messageCreate');

      const mockMessage = {
        author: {
          bot: false,
          id: 'user-1',
          username: 'test',
          displayName: 'Test',
        },
        mentions: { users: new Map([['bot-123', {}]]) },
        guild: { id: 'guild-1' },
        content: '<@bot-123> hello',
        channel: { id: 'chan-1', name: 'general', isThread: () => false },
      };

      await handler?.(mockMessage);

      const upsertCall = (ctx.db.thread.upsert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(upsertCall?.create).not.toHaveProperty('agent');
    });

    it('ignores messages from bots', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, 'messageCreate');

      const botMessage = {
        author: { bot: true, id: 'other-bot', username: 'bot' },
        mentions: { users: new Map() },
        guild: { id: 'guild-1' },
        content: 'bot message',
        channel: { id: 'chan-1', name: 'general', isThread: () => false },
      };

      await handler?.(botMessage);

      expect(ctx.broadcast).not.toHaveBeenCalled();
    });

    it('ignores messages with empty content after stripping mentions', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, 'messageCreate');

      const emptyMentionMessage = {
        author: {
          bot: false,
          id: 'user-1',
          username: 'test',
          displayName: 'Test',
        },
        mentions: { users: new Map([['bot-123', {}]]) },
        guild: { id: 'guild-1' },
        content: '<@bot-123>',
        channel: { id: 'chan-1', name: 'general', isThread: () => false },
      };

      await handler?.(emptyMentionMessage);

      expect(ctx.broadcast).not.toHaveBeenCalled();
    });

    it('handles database errors during message processing', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });
      (ctx.db.thread.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB connection lost'));

      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, 'messageCreate');

      const validMessage = {
        author: {
          bot: false,
          id: 'user-1',
          username: 'test',
          displayName: 'Test',
        },
        mentions: { users: new Map([['bot-123', {}]]) },
        guild: { id: 'guild-1' },
        content: '<@bot-123> hello',
        channel: { id: 'chan-1', name: 'general', isThread: () => false },
      };

      await handler?.(validMessage);

      expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('failed to process message'));
    });

    it('retries message delivery after P2002 upsert race when thread is found', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      const p2002Error = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
      });
      const mockFindUnique = vi.fn().mockResolvedValue({ id: 'thread-existing' });
      (ctx.db.thread.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(p2002Error);
      (ctx.db.thread as unknown as Record<string, unknown>).findUnique = mockFindUnique;

      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, 'messageCreate');

      const validMessage = {
        author: {
          bot: false,
          id: 'user-1',
          username: 'test',
          displayName: 'Test',
        },
        mentions: { users: new Map([['bot-123', {}]]) },
        guild: { id: 'guild-1' },
        content: '<@bot-123> hello',
        channel: { id: 'chan-1', name: 'general', isThread: () => false },
      };

      await handler?.(validMessage);

      expect(ctx.db.message.create as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ threadId: 'thread-existing' }),
        }),
      );
      expect(ctx.broadcast).toHaveBeenCalledWith('discord:message', expect.objectContaining({ threadId: 'thread-existing' }));
      expect(ctx.sendToThread).toHaveBeenCalledWith('thread-existing', 'hello');
    });

    it('handles P2002 race silently when retry find returns null', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      const p2002Error = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
      });
      const mockFindUnique = vi.fn().mockResolvedValue(null);
      (ctx.db.thread.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(p2002Error);
      (ctx.db.thread as unknown as Record<string, unknown>).findUnique = mockFindUnique;

      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, 'messageCreate');

      const validMessage = {
        author: {
          bot: false,
          id: 'user-1',
          username: 'test',
          displayName: 'Test',
        },
        mentions: { users: new Map([['bot-123', {}]]) },
        guild: { id: 'guild-1' },
        content: '<@bot-123> hello',
        channel: { id: 'chan-1', name: 'general', isThread: () => false },
      };

      await handler?.(validMessage);

      // No discord:message broadcast when thread is still not found after race retry
      const broadcastCalls = (ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls;
      const discordMsgCalls = broadcastCalls.filter((c: unknown[]) => c[0] === 'discord:message');
      expect(discordMsgCalls).toHaveLength(0);
    });

    it('logs error when retry itself fails after P2002 race', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      const p2002Error = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
      });
      const mockFindUnique = vi.fn().mockRejectedValue(new Error('retry DB failed'));
      (ctx.db.thread.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(p2002Error);
      (ctx.db.thread as unknown as Record<string, unknown>).findUnique = mockFindUnique;

      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, 'messageCreate');

      const validMessage = {
        author: {
          bot: false,
          id: 'user-1',
          username: 'test',
          displayName: 'Test',
        },
        mentions: { users: new Map([['bot-123', {}]]) },
        guild: { id: 'guild-1' },
        content: '<@bot-123> hello',
        channel: { id: 'chan-1', name: 'general', isThread: () => false },
      };

      await handler?.(validMessage);

      expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('retry after race failed'));
    });
  });

  describe('connection broadcasts', () => {
    it('broadcasts connected status when ClientReady fires', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start!(ctx);

      type ReadyHandler = (readyClient: { user: { tag: string } }) => void;
      const handler = findHandler<ReadyHandler>(mockOnce, 'ready');
      expect(handler).toBeDefined();

      handler?.({ user: { tag: 'HarnessBot#1234' } });

      expect(ctx.broadcast).toHaveBeenCalledWith('discord:connection', {
        connected: true,
        username: 'HarnessBot#1234',
      });
    });

    it('broadcasts disconnected status when ShardDisconnect fires', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start!(ctx);

      type DisconnectHandler = () => void;
      const handler = findHandler<DisconnectHandler>(mockOn, 'shardDisconnect');
      expect(handler).toBeDefined();

      handler?.();

      expect(ctx.broadcast).toHaveBeenCalledWith('discord:connection', {
        connected: false,
      });
    });

    it('broadcasts connected status when ShardResume fires', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start!(ctx);

      type ResumeHandler = () => void;
      const handler = findHandler<ResumeHandler>(mockOn, 'shardResume');
      expect(handler).toBeDefined();

      handler?.();

      expect(ctx.broadcast).toHaveBeenCalledWith('discord:connection', {
        connected: true,
      });
    });
  });

  describe('stop', () => {
    it('stop succeeds when no client is active', async () => {
      const ctx = createMockContext();
      await expect(plugin.stop?.(ctx)).resolves.not.toThrow();
    });

    it('destroys client when active', async () => {
      mockLogin.mockResolvedValue('token');
      mockDestroy.mockResolvedValue(undefined);
      const ctx = createMockContext({ discordToken: 'test-token' });

      await plugin.start?.(ctx);
      await plugin.stop?.(ctx);

      expect(mockDestroy).toHaveBeenCalled();
      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('disconnected'));
    });
  });

  describe('onSettingsChange', () => {
    it('does nothing when pluginName is not discord', async () => {
      const ctx = createMockContext({ discordToken: 'test-token' });
      const hooks = await plugin.register(ctx);

      mockLogin.mockResolvedValue('token');
      await plugin.start?.(ctx);
      vi.clearAllMocks();

      await hooks.onSettingsChange?.('other-plugin');

      expect(mockDestroy).not.toHaveBeenCalled();
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('reconnects when pluginName is discord and client is active', async () => {
      mockLogin.mockResolvedValue('token');
      mockDestroy.mockResolvedValue(undefined);
      const ctx = createMockContext({ discordToken: 'old-token' });
      (ctx.getSettings as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({}) // first call in register
        .mockResolvedValue({ botToken: 'new-token' }); // subsequent calls in onSettingsChange

      const hooks = await plugin.register(ctx);
      await plugin.start?.(ctx);
      vi.clearAllMocks();
      mockLogin.mockResolvedValue('token');
      mockDestroy.mockResolvedValue(undefined);

      await hooks.onSettingsChange?.('discord');

      expect(mockDestroy).toHaveBeenCalled();
      expect(mockLogin).toHaveBeenCalledWith('new-token');
      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('reconnected with updated token'));
    });

    it('disconnects when token is cleared from settings', async () => {
      mockLogin.mockResolvedValue('token');
      mockDestroy.mockResolvedValue(undefined);
      const ctx = createMockContext({ discordToken: undefined });
      (ctx.getSettings as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ botToken: 'initial-token' }) // register
        .mockResolvedValue({}); // onSettingsChange — no botToken, no env fallback

      const hooks = await plugin.register(ctx);
      await plugin.start?.(ctx);
      vi.clearAllMocks();
      mockDestroy.mockResolvedValue(undefined);

      await hooks.onSettingsChange?.('discord');

      expect(mockDestroy).toHaveBeenCalled();
      expect(mockLogin).not.toHaveBeenCalled();
      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('bot token removed'));
      expect(ctx.reportStatus).toHaveBeenCalledWith('degraded', 'No bot token configured');
    });

    it('destroys existing client even when reconnecting with new token', async () => {
      mockLogin.mockResolvedValue('token');
      mockDestroy.mockResolvedValue(undefined);
      const ctx = createMockContext({ discordToken: 'env-token' });
      (ctx.getSettings as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({}) // register
        .mockResolvedValue({ botToken: 'new-token' }); // onSettingsChange

      const hooks = await plugin.register(ctx);
      await plugin.start?.(ctx);
      vi.clearAllMocks();
      mockLogin.mockResolvedValue('token');
      mockDestroy.mockResolvedValue(undefined);

      await hooks.onSettingsChange?.('discord');

      // Client should be destroyed before reconnecting
      expect(mockDestroy).toHaveBeenCalled();
      expect(mockLogin).toHaveBeenCalledWith('new-token');
    });

    it('does not crash when no client is active and token is cleared', async () => {
      const ctx = createMockContext();
      const hooks = await plugin.register(ctx);

      // Do not call start — no client is set
      await hooks.onSettingsChange?.('discord');

      // Should not attempt login since there is no token
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('reloads allowedChannels on settings change', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });
      (ctx.getSettings as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({}) // register
        .mockResolvedValue({
          botToken: 'test-token',
          allowedChannelIds: 'chan-1, chan-2',
        }); // onSettingsChange

      const hooks = await plugin.register(ctx);
      await plugin.start?.(ctx);

      await hooks.onSettingsChange?.('discord');

      // Verify it re-fetched settings (the allowed channels parsing is internal,
      // but we verify getSettings was called during onSettingsChange)
      expect(ctx.getSettings).toHaveBeenCalledTimes(2);
    });

    it('applies updated allowedChannels to subsequent message filtering', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });
      // First register: no channel restrictions
      (ctx.getSettings as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({}) // register — no allowedChannelIds
        .mockResolvedValue({
          botToken: 'test-token',
          allowedChannelIds: 'other-channel-only',
        }); // onSettingsChange

      const hooks = await plugin.register(ctx);
      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, 'messageCreate');

      const mentionedMessage = {
        author: {
          bot: false,
          id: 'user-1',
          username: 'test',
          displayName: 'Test',
        },
        mentions: { users: new Map([['bot-123', {}]]) },
        guild: { id: 'guild-1' },
        channelId: 'chan-1',
        content: '<@bot-123> hello',
        channel: {
          id: 'chan-1',
          name: 'general',
          isThread: () => false,
        },
      };

      // Before settings change: chan-1 should be processed (no restrictions)
      await handler?.(mentionedMessage);
      expect(ctx.sendToThread).toHaveBeenCalled();
      (ctx.sendToThread as ReturnType<typeof vi.fn>).mockClear();
      (ctx.db.thread.upsert as ReturnType<typeof vi.fn>).mockClear();
      (ctx.db.message.create as ReturnType<typeof vi.fn>).mockClear();
      (ctx.broadcast as ReturnType<typeof vi.fn>).mockClear();

      // Trigger settings change — now only 'other-channel-only' is allowed
      await hooks.onSettingsChange?.('discord');

      // After settings change: chan-1 should be filtered out
      await handler?.(mentionedMessage);
      expect(ctx.sendToThread).not.toHaveBeenCalled();
    });

    it('uses re-cached defaultAgentId after settings change', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });

      // Initial register: agent-original
      (ctx.db.agent.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 'agent-original' }) // register
        .mockResolvedValue({ id: 'agent-updated' }); // onSettingsChange re-cache
      (ctx.getSettings as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({}) // register
        .mockResolvedValue({ botToken: 'test-token' }); // onSettingsChange

      const hooks = await plugin.register(ctx);
      await plugin.start?.(ctx);

      // Trigger settings change — should re-cache defaultAgentId to 'agent-updated'
      await hooks.onSettingsChange?.('discord');

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, 'messageCreate');

      const mockMessage = {
        author: {
          bot: false,
          id: 'user-1',
          username: 'test',
          displayName: 'Test',
        },
        mentions: { users: new Map([['bot-123', {}]]) },
        guild: { id: 'guild-1' },
        content: '<@bot-123> hello',
        channel: {
          id: 'chan-new',
          name: 'new-channel',
          isThread: () => false,
        },
      };

      await handler?.(mockMessage);

      expect(ctx.db.thread.upsert as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            agent: { connect: { id: 'agent-updated' } },
          }),
        }),
      );
    });
  });

  describe('splitMessage', () => {
    it('returns single chunk for short messages', () => {
      const result = splitMessage('hello world');
      expect(result).toEqual(['hello world']);
    });

    it('returns single chunk for exactly 2000 chars', () => {
      const msg = 'a'.repeat(2000);
      const result = splitMessage(msg);
      expect(result).toEqual([msg]);
    });

    it('splits long messages at newlines', () => {
      const line = 'a'.repeat(1500);
      const content = `${line}\n${'b'.repeat(1500)}`;
      const result = splitMessage(content);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(line);
      expect(result[1]).toBe('b'.repeat(1500));
    });

    it('splits at spaces when no newline available', () => {
      const word = 'word '.repeat(500);
      const result = splitMessage(word);

      expect(result.length).toBeGreaterThanOrEqual(2);
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
    });

    it('hard splits when no space or newline', () => {
      const content = 'a'.repeat(5000);
      const result = splitMessage(content);

      expect(result.length).toBeGreaterThanOrEqual(3);
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
    });

    it('handles empty string', () => {
      const result = splitMessage('');
      expect(result).toEqual([]);
    });
  });

  describe('onBroadcast', () => {
    it('ignores non-pipeline:complete events', async () => {
      const ctx = createMockContext({ discordToken: 'test-token' });
      const hooks = await plugin.register(ctx);

      await hooks.onBroadcast!('chat:message', { threadId: 'thread-1' });

      expect(mockSendDiscordReply).not.toHaveBeenCalled();
    });

    it('skips when client is null (not started)', async () => {
      const ctx = createMockContext({ discordToken: 'test-token' });
      const hooks = await plugin.register(ctx);

      await hooks.onBroadcast!('pipeline:complete', {
        threadId: 'thread-1',
      });

      expect(mockSendDiscordReply).not.toHaveBeenCalled();
    });

    it('skips when client exists but not connected', async () => {
      const ctx = createMockContext({ discordToken: 'test-token' });
      const hooks = await plugin.register(ctx);
      // Start the plugin to create a client, but don't simulate the ready event
      mockLogin.mockResolvedValue('test-token');
      await plugin.start!(ctx);

      // state.connected is false until the 'ready' event fires
      await hooks.onBroadcast!('pipeline:complete', {
        threadId: 'thread-1',
      });

      expect(mockSendDiscordReply).not.toHaveBeenCalled();
    });

    it('calls sendDiscordReply when connected and pipeline:complete', async () => {
      const ctx = createMockContext({ discordToken: 'test-token' });
      const hooks = await plugin.register(ctx);
      mockLogin.mockResolvedValue('test-token');
      await plugin.start!(ctx);

      // Simulate the 'ready' event to set state.connected = true
      const readyHandler = findHandler<(client: { user: { tag: string } }) => void>(mockOnce, 'ready');
      readyHandler?.({ user: { tag: 'TestBot#1234' } });

      await hooks.onBroadcast!('pipeline:complete', {
        threadId: 'thread-1',
      });

      expect(mockSendDiscordReply).toHaveBeenCalledWith(expect.objectContaining({ threadId: 'thread-1' }));
    });

    it('catches and logs errors from sendDiscordReply', async () => {
      const ctx = createMockContext({ discordToken: 'test-token' });
      const hooks = await plugin.register(ctx);
      mockLogin.mockResolvedValue('test-token');
      await plugin.start!(ctx);

      const readyHandler = findHandler<(client: { user: { tag: string } }) => void>(mockOnce, 'ready');
      readyHandler?.({ user: { tag: 'TestBot#1234' } });

      mockSendDiscordReply.mockRejectedValueOnce(new Error('delivery failed'));

      await hooks.onBroadcast!('pipeline:complete', {
        threadId: 'thread-1',
      });

      expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('delivery failed'));
    });

    it('logs non-Error objects from sendDiscordReply via String()', async () => {
      const ctx = createMockContext({ discordToken: 'test-token' });
      const hooks = await plugin.register(ctx);
      mockLogin.mockResolvedValue('test-token');
      await plugin.start!(ctx);

      const readyHandler = findHandler<(client: { user: { tag: string } }) => void>(mockOnce, 'ready');
      readyHandler?.({ user: { tag: 'TestBot#1234' } });

      mockSendDiscordReply.mockRejectedValueOnce('string-error');

      await hooks.onBroadcast!('pipeline:complete', {
        threadId: 'thread-1',
      });

      expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('string-error'));
    });

    it('skips onBroadcast delivery after ShardDisconnect fires', async () => {
      mockLogin.mockResolvedValue('token');
      const ctx = createMockContext({ discordToken: 'test-token' });
      const hooks = await plugin.register(ctx);
      await plugin.start!(ctx);

      // Simulate ready -> connected
      const readyHandler = findHandler<(client: { user: { tag: string } }) => void>(mockOnce, 'ready');
      readyHandler?.({ user: { tag: 'TestBot#1234' } });

      // Verify delivery works when connected
      await hooks.onBroadcast!('pipeline:complete', {
        threadId: 'thread-1',
      });
      expect(mockSendDiscordReply).toHaveBeenCalledTimes(1);

      // Simulate disconnect
      const disconnectHandler = findHandler<() => void>(mockOn, 'shardDisconnect');
      disconnectHandler?.();

      // Verify delivery is skipped when disconnected
      mockSendDiscordReply.mockClear();
      await hooks.onBroadcast!('pipeline:complete', {
        threadId: 'thread-1',
      });
      expect(mockSendDiscordReply).not.toHaveBeenCalled();
    });
  });
});
