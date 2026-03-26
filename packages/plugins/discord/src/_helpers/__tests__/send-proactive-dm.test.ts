import type { Client } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { sendProactiveDm } from '../send-proactive-dm';

const makeMockClient = () => {
  const dmChannel = {
    send: vi.fn().mockResolvedValue(undefined),
  };
  const mockUser = {
    createDM: vi.fn().mockResolvedValue(dmChannel),
  };
  const client = {
    users: {
      fetch: vi.fn().mockResolvedValue(mockUser),
    },
  } as unknown as Client;

  return { client, mockUser, dmChannel };
};

const splitMessage = (content: string) => [content];

describe('sendProactiveDm', () => {
  it('sends a message to the user via DM channel', async () => {
    const { client, mockUser, dmChannel } = makeMockClient();

    await sendProactiveDm({
      client,
      userId: 'user-123',
      content: 'Hello proactively!',
      splitMessage,
    });

    expect(client.users.fetch).toHaveBeenCalledWith('user-123');
    expect(mockUser.createDM).toHaveBeenCalled();
    expect(dmChannel.send).toHaveBeenCalledWith('Hello proactively!');
  });

  it('sends multiple chunks when content is split', async () => {
    const { client, dmChannel } = makeMockClient();
    const multiSplit = (_content: string) => ['chunk1', 'chunk2', 'chunk3'];

    await sendProactiveDm({
      client,
      userId: 'user-123',
      content: 'long content',
      splitMessage: multiSplit,
    });

    expect(dmChannel.send).toHaveBeenCalledTimes(3);
    expect(dmChannel.send).toHaveBeenNthCalledWith(1, 'chunk1');
    expect(dmChannel.send).toHaveBeenNthCalledWith(2, 'chunk2');
    expect(dmChannel.send).toHaveBeenNthCalledWith(3, 'chunk3');
  });

  it('throws when user cannot be fetched', async () => {
    const client = {
      users: {
        fetch: vi.fn().mockRejectedValue(new Error('Unknown User')),
      },
    } as unknown as Client;

    await expect(
      sendProactiveDm({
        client,
        userId: 'bad-user',
        content: 'hello',
        splitMessage,
      }),
    ).rejects.toThrow('Unknown User');
  });

  it('throws when DM channel cannot be created', async () => {
    const mockUser = {
      createDM: vi.fn().mockRejectedValue(new Error('Cannot DM')),
    };
    const client = {
      users: {
        fetch: vi.fn().mockResolvedValue(mockUser),
      },
    } as unknown as Client;

    await expect(
      sendProactiveDm({
        client,
        userId: 'user-123',
        content: 'hello',
        splitMessage,
      }),
    ).rejects.toThrow('Cannot DM');
  });
});
