import type { Message as DiscordMessage } from "discord.js";
import { describe, expect, it } from "vitest";
import {
  shouldProcessMessage,
  stripMentions,
  toPipelineMessage,
} from "./message-adapter";

type MockMessage = {
  author: { bot: boolean; id: string; username: string; displayName?: string };
  mentions: { users: Map<string, unknown> };
  guild: { id: string } | null;
  content: string;
  channel: {
    id: string;
    name: string;
    isThread: () => boolean;
  };
};

const createMockMessage = (
  overrides: Partial<MockMessage> = {}
): MockMessage => ({
  author: {
    bot: false,
    id: "user-123",
    username: "testuser",
    displayName: "Test User",
  },
  mentions: { users: new Map() },
  guild: { id: "guild-1" },
  content: "hello bot",
  channel: {
    id: "channel-456",
    name: "general",
    isThread: () => false,
  },
  ...overrides,
});

describe("message-adapter", () => {
  describe("shouldProcessMessage", () => {
    const botUserId = "bot-999";

    it("ignores messages from bots", () => {
      const msg = createMockMessage({
        author: { bot: true, id: "other-bot", username: "otherbot" },
      });

      expect(
        shouldProcessMessage(msg as unknown as DiscordMessage, botUserId)
      ).toBe(false);
    });

    it("processes messages that mention the bot", () => {
      const mentions = new Map([["bot-999", { id: "bot-999" }]]);
      const msg = createMockMessage({ mentions: { users: mentions } });

      expect(
        shouldProcessMessage(msg as unknown as DiscordMessage, botUserId)
      ).toBe(true);
    });

    it("processes DMs (no guild)", () => {
      const msg = createMockMessage({ guild: null });

      expect(
        shouldProcessMessage(msg as unknown as DiscordMessage, botUserId)
      ).toBe(true);
    });

    it("ignores guild messages without mention", () => {
      const msg = createMockMessage();

      expect(
        shouldProcessMessage(msg as unknown as DiscordMessage, botUserId)
      ).toBe(false);
    });

    it("ignores the bot's own messages", () => {
      const msg = createMockMessage({
        author: { bot: true, id: botUserId, username: "harness-bot" },
      });

      expect(
        shouldProcessMessage(msg as unknown as DiscordMessage, botUserId)
      ).toBe(false);
    });
  });

  describe("stripMentions", () => {
    const botUserId = "bot-999";

    it("removes bot mention from content", () => {
      expect(stripMentions("<@bot-999> hello", botUserId)).toBe("hello");
    });

    it("removes bot mention with exclamation mark", () => {
      expect(stripMentions("<@!bot-999> hello", botUserId)).toBe("hello");
    });

    it("removes multiple mentions of the bot", () => {
      expect(stripMentions("<@bot-999> hi <@bot-999>", botUserId)).toBe("hi");
    });

    it("preserves other user mentions", () => {
      expect(stripMentions("<@other-123> hello <@bot-999>", botUserId)).toBe(
        "<@other-123> hello"
      );
    });

    it("returns trimmed content when no mention present", () => {
      expect(stripMentions("  hello world  ", botUserId)).toBe("hello world");
    });

    it("returns empty string when content is only the mention", () => {
      expect(stripMentions("<@bot-999>", botUserId)).toBe("");
    });
  });

  describe("toPipelineMessage", () => {
    it("converts a Discord message to pipeline format", () => {
      const msg = createMockMessage({
        content: "deploy the app",
      });

      const result = toPipelineMessage(msg as unknown as DiscordMessage);

      expect(result).toEqual({
        threadId: "",
        sourceId: "discord:channel-456",
        role: "user",
        content: "deploy the app",
        authorId: "user-123",
        authorName: "Test User",
        channelName: "general",
        isThread: false,
      });
    });

    it("uses username when displayName is not available", () => {
      const msg = createMockMessage({
        author: {
          bot: false,
          id: "user-123",
          username: "testuser",
          displayName: undefined,
        },
      });

      const result = toPipelineMessage(msg as unknown as DiscordMessage);

      expect(result.authorName).toBe("testuser");
    });

    it("marks thread messages correctly", () => {
      const msg = createMockMessage({
        channel: {
          id: "thread-789",
          name: "my-thread",
          isThread: () => true,
        },
      });

      // Thread channels also need parentId for the resolver
      (msg.channel as Record<string, unknown>).parentId = "channel-456";

      const result = toPipelineMessage(msg as unknown as DiscordMessage);

      expect(result.isThread).toBe(true);
      expect(result.sourceId).toBe("discord:thread-789");
    });
  });
});
