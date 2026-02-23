import type { Message as DiscordMessage } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { toPipelineMessage } from '../message-adapter';

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

describe('toPipelineMessage', () => {
  it('converts a Discord message to pipeline format', () => {
    const msg = createMockMessage({
      content: 'deploy the app',
    });

    const result = toPipelineMessage(msg as unknown as DiscordMessage);

    expect(result).toEqual({
      threadId: '',
      sourceId: 'discord:channel-456',
      role: 'user',
      content: 'deploy the app',
      authorId: 'user-123',
      authorName: 'Test User',
      channelName: 'general',
      isThread: false,
    });
  });

  it('uses username when displayName is not available', () => {
    const msg = createMockMessage({
      author: {
        bot: false,
        id: 'user-123',
        username: 'testuser',
        displayName: undefined,
      },
    });

    const result = toPipelineMessage(msg as unknown as DiscordMessage);

    expect(result.authorName).toBe('testuser');
  });

  it('marks thread messages correctly', () => {
    const msg = createMockMessage({
      channel: {
        id: 'thread-789',
        name: 'my-thread',
        isThread: () => true,
      },
    });

    // Thread channels also need parentId for the resolver
    (msg.channel as Record<string, unknown>).parentId = 'channel-456';

    const result = toPipelineMessage(msg as unknown as DiscordMessage);

    expect(result.isThread).toBe(true);
    expect(result.sourceId).toBe('discord:thread-789');
  });
});
