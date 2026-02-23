import type { Message as DiscordMessage } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { shouldProcessMessage } from '../should-process-message';

type MockMessage = {
  author: {
    bot: boolean;
    id: string;
    username: string;
    displayName?: string;
  };
  mentions: { users: Map<string, unknown> };
  guild: { id: string } | null;
  content: string;
  channel: {
    id: string;
    name: string;
    isThread: () => boolean;
  };
};

const createMockMessage = (overrides: Partial<MockMessage> = {}): MockMessage => ({
  author: {
    bot: false,
    id: 'user-123',
    username: 'testuser',
    displayName: 'Test User',
  },
  mentions: { users: new Map() },
  guild: { id: 'guild-1' },
  content: 'hello bot',
  channel: {
    id: 'channel-456',
    name: 'general',
    isThread: () => false,
  },
  ...overrides,
});

describe('shouldProcessMessage', () => {
  const botUserId = 'bot-999';

  it('ignores messages from bots', () => {
    const msg = createMockMessage({
      author: { bot: true, id: 'other-bot', username: 'otherbot' },
    });

    expect(shouldProcessMessage(msg as unknown as DiscordMessage, botUserId)).toBe(false);
  });

  it('processes messages that mention the bot', () => {
    const mentions = new Map([['bot-999', { id: 'bot-999' }]]);
    const msg = createMockMessage({ mentions: { users: mentions } });

    expect(shouldProcessMessage(msg as unknown as DiscordMessage, botUserId)).toBe(true);
  });

  it('processes DMs (no guild)', () => {
    const msg = createMockMessage({ guild: null });

    expect(shouldProcessMessage(msg as unknown as DiscordMessage, botUserId)).toBe(true);
  });

  it('ignores guild messages without mention', () => {
    const msg = createMockMessage();

    expect(shouldProcessMessage(msg as unknown as DiscordMessage, botUserId)).toBe(false);
  });

  it("ignores the bot's own messages", () => {
    const msg = createMockMessage({
      author: { bot: true, id: botUserId, username: 'harness-bot' },
    });

    expect(shouldProcessMessage(msg as unknown as DiscordMessage, botUserId)).toBe(false);
  });
});
