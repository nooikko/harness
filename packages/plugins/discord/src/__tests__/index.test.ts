import type { PluginContext } from "@harness/plugin-contract";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscordPluginState } from "../index";
import { getSendMessage, plugin, splitMessage } from "../index";

// Mock discord.js at the module level -- vi.mock is hoisted, so all references
// must be defined inside the factory or use vi.hoisted().
const { mockOn, mockOnce, mockLogin, mockDestroy, mockFetchChannel } = vi.hoisted(() => ({
  mockOn: vi.fn(),
  mockOnce: vi.fn(),
  mockLogin: vi.fn(),
  mockDestroy: vi.fn(),
  mockFetchChannel: vi.fn(),
}));

vi.mock("discord.js", () => {
  class MockClient {
    on = mockOn;
    once = mockOnce;
    login = mockLogin;
    destroy = mockDestroy;
    channels = { fetch: mockFetchChannel };
    user = { id: "bot-123", tag: "HarnessBot#1234" };
  }

  return {
    Client: MockClient,
    Events: {
      ClientReady: "ready",
      Error: "error",
      Warn: "warn",
      MessageCreate: "messageCreate",
      ShardDisconnect: "shardDisconnect",
      ShardReconnecting: "shardReconnecting",
      ShardResume: "shardResume",
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

const createMockContext = (overrides: Partial<PluginContext["config"]> = {}): PluginContext => ({
  db: {
    thread: {
      upsert: vi.fn().mockResolvedValue({ id: "thread-1" }),
    },
    message: {
      create: vi.fn(),
    },
  } as unknown as PluginContext["db"],
  invoker: { invoke: vi.fn() },
  config: {
    databaseUrl: "postgres://localhost:5432/test",
    timezone: "America/Phoenix",
    maxConcurrentAgents: 3,
    claudeModel: "sonnet",
    claudeTimeout: 300000,
    discordToken: undefined,
    discordChannelId: undefined,
    port: 3001,
    logLevel: "info",
    ...overrides,
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  sendToThread: vi.fn(),
  broadcast: vi.fn(),
});

describe("discord plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("plugin definition", () => {
    it("has required plugin metadata", () => {
      expect(plugin.name).toBe("discord");
      expect(plugin.version).toBe("1.0.0");
      expect(typeof plugin.register).toBe("function");
      expect(typeof plugin.start).toBe("function");
      expect(typeof plugin.stop).toBe("function");
    });

    it("register returns a hooks object", async () => {
      const ctx = createMockContext();
      const hooks = await plugin.register(ctx);

      expect(hooks).toBeDefined();
      expect(typeof hooks).toBe("object");
    });
  });

  describe("start", () => {
    it("logs warning and skips connection when no token", async () => {
      const ctx = createMockContext();

      await plugin.start?.(ctx);

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining("DISCORD_TOKEN not set"));
    });

    it("creates client and logs in when token is provided", async () => {
      mockLogin.mockResolvedValue("token");
      const ctx = createMockContext({ discordToken: "test-token" });

      await plugin.start?.(ctx);

      expect(mockLogin).toHaveBeenCalledWith("test-token");
      expect(mockOn).toHaveBeenCalled();
      expect(mockOnce).toHaveBeenCalled();
    });

    it("registers event handlers on the client", async () => {
      mockLogin.mockResolvedValue("token");
      const ctx = createMockContext({ discordToken: "test-token" });

      await plugin.start?.(ctx);

      const onEvents = getEventNames(mockOn);
      const onceEvents = getEventNames(mockOnce);

      expect(onceEvents).toContain("ready");
      expect(onEvents).toContain("error");
      expect(onEvents).toContain("warn");
      expect(onEvents).toContain("shardDisconnect");
      expect(onEvents).toContain("shardReconnecting");
      expect(onEvents).toContain("shardResume");
      expect(onEvents).toContain("messageCreate");
    });

    it("handles login failure gracefully", async () => {
      mockLogin.mockRejectedValue(new Error("Invalid token"));
      const ctx = createMockContext({ discordToken: "bad-token" });

      await plugin.start?.(ctx);

      expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining("failed to connect"));
    });

    it("fires ClientReady handler to set connected state", async () => {
      mockLogin.mockResolvedValue("token");
      const ctx = createMockContext({ discordToken: "test-token" });

      await plugin.start?.(ctx);

      type ReadyHandler = (readyClient: { user: { tag: string } }) => void;
      const handler = findHandler<ReadyHandler>(mockOnce, "ready");
      expect(handler).toBeDefined();

      handler?.({ user: { tag: "HarnessBot#1234" } });

      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining("connected as HarnessBot#1234"));
    });

    it("fires ShardDisconnect handler", async () => {
      mockLogin.mockResolvedValue("token");
      const ctx = createMockContext({ discordToken: "test-token" });

      await plugin.start?.(ctx);

      type DisconnectHandler = () => void;
      const handler = findHandler<DisconnectHandler>(mockOn, "shardDisconnect");
      expect(handler).toBeDefined();

      handler?.();

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining("disconnected from gateway"));
    });

    it("fires ShardReconnecting handler", async () => {
      mockLogin.mockResolvedValue("token");
      const ctx = createMockContext({ discordToken: "test-token" });

      await plugin.start?.(ctx);

      type ReconnectingHandler = () => void;
      const handler = findHandler<ReconnectingHandler>(mockOn, "shardReconnecting");
      expect(handler).toBeDefined();

      handler?.();

      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining("reconnecting to gateway"));
    });

    it("fires ShardResume handler", async () => {
      mockLogin.mockResolvedValue("token");
      const ctx = createMockContext({ discordToken: "test-token" });

      await plugin.start?.(ctx);

      type ResumeHandler = () => void;
      const handler = findHandler<ResumeHandler>(mockOn, "shardResume");
      expect(handler).toBeDefined();

      handler?.();

      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining("reconnected to gateway"));
    });

    it("fires Error handler on client error", async () => {
      mockLogin.mockResolvedValue("token");
      const ctx = createMockContext({ discordToken: "test-token" });

      await plugin.start?.(ctx);

      type ErrorHandler = (err: Error) => void;
      const handler = findHandler<ErrorHandler>(mockOn, "error");
      expect(handler).toBeDefined();

      handler?.(new Error("WebSocket error"));

      expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining("WebSocket error"));
    });

    it("fires Warn handler on client warning", async () => {
      mockLogin.mockResolvedValue("token");
      const ctx = createMockContext({ discordToken: "test-token" });

      await plugin.start?.(ctx);

      type WarnHandler = (msg: string) => void;
      const handler = findHandler<WarnHandler>(mockOn, "warn");
      expect(handler).toBeDefined();

      handler?.("Rate limited");

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining("Rate limited"));
    });

    it("processes a valid message through the pipeline", async () => {
      mockLogin.mockResolvedValue("token");
      const ctx = createMockContext({ discordToken: "test-token" });

      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, "messageCreate");
      expect(handler).toBeDefined();

      const mockMessage = {
        author: {
          bot: false,
          id: "user-1",
          username: "test",
          displayName: "Test",
        },
        mentions: { users: new Map([["bot-123", {}]]) },
        guild: { id: "guild-1" },
        content: "<@bot-123> hello",
        channel: {
          id: "chan-1",
          name: "general",
          isThread: () => false,
        },
      };

      await handler?.(mockMessage);

      expect(ctx.db.thread.upsert as ReturnType<typeof vi.fn>).toHaveBeenCalled();
      expect(ctx.db.message.create as ReturnType<typeof vi.fn>).toHaveBeenCalled();
      expect(ctx.broadcast).toHaveBeenCalledWith("discord:message", expect.any(Object));
    });

    it("ignores messages from bots", async () => {
      mockLogin.mockResolvedValue("token");
      const ctx = createMockContext({ discordToken: "test-token" });

      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, "messageCreate");

      const botMessage = {
        author: { bot: true, id: "other-bot", username: "bot" },
        mentions: { users: new Map() },
        guild: { id: "guild-1" },
        content: "bot message",
        channel: { id: "chan-1", name: "general", isThread: () => false },
      };

      await handler?.(botMessage);

      expect(ctx.broadcast).not.toHaveBeenCalled();
    });

    it("ignores messages with empty content after stripping mentions", async () => {
      mockLogin.mockResolvedValue("token");
      const ctx = createMockContext({ discordToken: "test-token" });

      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, "messageCreate");

      const emptyMentionMessage = {
        author: {
          bot: false,
          id: "user-1",
          username: "test",
          displayName: "Test",
        },
        mentions: { users: new Map([["bot-123", {}]]) },
        guild: { id: "guild-1" },
        content: "<@bot-123>",
        channel: { id: "chan-1", name: "general", isThread: () => false },
      };

      await handler?.(emptyMentionMessage);

      expect(ctx.broadcast).not.toHaveBeenCalled();
    });

    it("handles database errors during message processing", async () => {
      mockLogin.mockResolvedValue("token");
      const ctx = createMockContext({ discordToken: "test-token" });
      (ctx.db.thread.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB connection lost"));

      await plugin.start?.(ctx);

      type MessageHandler = (msg: unknown) => Promise<void>;
      const handler = findHandler<MessageHandler>(mockOn, "messageCreate");

      const validMessage = {
        author: {
          bot: false,
          id: "user-1",
          username: "test",
          displayName: "Test",
        },
        mentions: { users: new Map([["bot-123", {}]]) },
        guild: { id: "guild-1" },
        content: "<@bot-123> hello",
        channel: { id: "chan-1", name: "general", isThread: () => false },
      };

      await handler?.(validMessage);

      expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining("failed to process message"));
    });
  });

  describe("stop", () => {
    it("stop succeeds when no client is active", async () => {
      const ctx = createMockContext();
      await expect(plugin.stop?.(ctx)).resolves.not.toThrow();
    });

    it("destroys client when active", async () => {
      mockLogin.mockResolvedValue("token");
      mockDestroy.mockResolvedValue(undefined);
      const ctx = createMockContext({ discordToken: "test-token" });

      await plugin.start?.(ctx);
      await plugin.stop?.(ctx);

      expect(mockDestroy).toHaveBeenCalled();
      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining("disconnected"));
    });
  });

  describe("splitMessage", () => {
    it("returns single chunk for short messages", () => {
      const result = splitMessage("hello world");
      expect(result).toEqual(["hello world"]);
    });

    it("returns single chunk for exactly 2000 chars", () => {
      const msg = "a".repeat(2000);
      const result = splitMessage(msg);
      expect(result).toEqual([msg]);
    });

    it("splits long messages at newlines", () => {
      const line = "a".repeat(1500);
      const content = `${line}\n${"b".repeat(1500)}`;
      const result = splitMessage(content);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(line);
      expect(result[1]).toBe("b".repeat(1500));
    });

    it("splits at spaces when no newline available", () => {
      const word = "word ".repeat(500);
      const result = splitMessage(word);

      expect(result.length).toBeGreaterThanOrEqual(2);
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
    });

    it("hard splits when no space or newline", () => {
      const content = "a".repeat(5000);
      const result = splitMessage(content);

      expect(result.length).toBeGreaterThanOrEqual(3);
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
    });

    it("handles empty string", () => {
      const result = splitMessage("");
      expect(result).toEqual([""]);
    });
  });

  describe("getSendMessage", () => {
    let ctx: PluginContext;

    beforeEach(() => {
      ctx = createMockContext();
    });

    it("warns when client is not connected", async () => {
      const state: DiscordPluginState = { client: null, connected: false };
      const sendMessage = getSendMessage(state, ctx);

      await sendMessage("discord:123", "hello");

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining("client not connected"));
    });

    it("warns when connected is false even with client", async () => {
      const mockClient = {} as DiscordPluginState["client"];
      const state: DiscordPluginState = {
        client: mockClient,
        connected: false,
      };
      const sendMessage = getSendMessage(state, ctx);

      await sendMessage("discord:123", "hello");

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining("client not connected"));
    });

    it("warns when sourceId is not a discord sourceId", async () => {
      const mockClient = {
        channels: {
          fetch: vi.fn(),
        },
      } as unknown as DiscordPluginState["client"];
      const state: DiscordPluginState = {
        client: mockClient,
        connected: true,
      };
      const sendMessage = getSendMessage(state, ctx);

      await sendMessage("web:session-1", "hello");

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining("invalid sourceId"));
    });

    it("warns when channel is not found", async () => {
      const mockClient = {
        channels: {
          fetch: vi.fn().mockResolvedValue(null),
        },
      } as unknown as DiscordPluginState["client"];
      const state: DiscordPluginState = {
        client: mockClient,
        connected: true,
      };
      const sendMessage = getSendMessage(state, ctx);

      await sendMessage("discord:123", "hello");

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining("not found"));
    });

    it("warns when channel is not text-based", async () => {
      const mockClient = {
        channels: {
          fetch: vi.fn().mockResolvedValue({
            isTextBased: () => false,
          }),
        },
      } as unknown as DiscordPluginState["client"];
      const state: DiscordPluginState = {
        client: mockClient,
        connected: true,
      };
      const sendMessage = getSendMessage(state, ctx);

      await sendMessage("discord:123", "hello");

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining("not text-based"));
    });

    it("sends message to text channel", async () => {
      const mockSend = vi.fn();
      const mockClient = {
        channels: {
          fetch: vi.fn().mockResolvedValue({
            isTextBased: () => true,
            send: mockSend,
          }),
        },
      } as unknown as DiscordPluginState["client"];
      const state: DiscordPluginState = {
        client: mockClient,
        connected: true,
      };
      const sendMessage = getSendMessage(state, ctx);

      await sendMessage("discord:123", "hello");

      expect(mockSend).toHaveBeenCalledWith("hello");
    });

    it("splits long messages before sending", async () => {
      const mockSend = vi.fn();
      const mockClient = {
        channels: {
          fetch: vi.fn().mockResolvedValue({
            isTextBased: () => true,
            send: mockSend,
          }),
        },
      } as unknown as DiscordPluginState["client"];
      const state: DiscordPluginState = {
        client: mockClient,
        connected: true,
      };
      const sendMessage = getSendMessage(state, ctx);

      const longContent = "a".repeat(5000);
      await sendMessage("discord:123", longContent);

      expect(mockSend.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });
});
