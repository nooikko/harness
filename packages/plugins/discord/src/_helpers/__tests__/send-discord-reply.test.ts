import type { PluginContext } from '@harness/plugin-contract';
import type { Client } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendDiscordReply } from '../send-discord-reply';

type MockDb = {
  thread: { findUnique: ReturnType<typeof vi.fn> };
  message: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

const makeCtx = (db: MockDb): PluginContext =>
  ({
    db,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }) as unknown as PluginContext;

const makeSendableChannel = () => ({
  isSendable: () => true,
  send: vi.fn().mockResolvedValue(undefined),
});

const makeClient = (channel: ReturnType<typeof makeSendableChannel> | null = makeSendableChannel()) => {
  const fetchChannel = vi.fn().mockResolvedValue(channel);
  return {
    channels: { fetch: fetchChannel },
  } as unknown as Client;
};

const splitMessage = (content: string) => [content];

describe('sendDiscordReply', () => {
  let db: MockDb;

  beforeEach(() => {
    db = {
      thread: { findUnique: vi.fn() },
      message: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    };
  });

  it('sends a reply to the Discord channel for a discord-sourced thread', async () => {
    db.thread.findUnique.mockResolvedValue({ source: 'discord', sourceId: 'discord:channel-123' });
    db.message.findFirst.mockResolvedValueOnce({ content: 'Hello from Claude', createdAt: new Date() }).mockResolvedValueOnce(null);
    const channel = makeSendableChannel();
    const client = makeClient(channel);
    const ctx = makeCtx(db);

    await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

    expect(db.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      select: { source: true, sourceId: true },
    });
    expect(client.channels.fetch).toHaveBeenCalledWith('channel-123');
    expect(channel.send).toHaveBeenCalledWith('Hello from Claude');
  });

  it('does nothing for a non-discord thread', async () => {
    db.thread.findUnique.mockResolvedValue({ source: 'web', sourceId: 'web:session-abc' });
    const client = makeClient();
    const ctx = makeCtx(db);

    await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it('does nothing when the thread does not exist', async () => {
    db.thread.findUnique.mockResolvedValue(null);
    const client = makeClient();
    const ctx = makeCtx(db);

    await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it('does nothing when there is no assistant message to deliver', async () => {
    db.thread.findUnique.mockResolvedValue({ source: 'discord', sourceId: 'discord:channel-123' });
    db.message.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const channel = makeSendableChannel();
    const client = makeClient(channel);
    const ctx = makeCtx(db);

    await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

    expect(channel.send).not.toHaveBeenCalled();
  });

  it('does nothing when the assistant message has empty content', async () => {
    db.thread.findUnique.mockResolvedValue({ source: 'discord', sourceId: 'discord:channel-123' });
    db.message.findFirst.mockResolvedValueOnce({ content: '', createdAt: new Date() }).mockResolvedValueOnce(null);
    const channel = makeSendableChannel();
    const client = makeClient(channel);
    const ctx = makeCtx(db);

    await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

    expect(channel.send).not.toHaveBeenCalled();
  });

  it('warns and returns when the channel cannot be fetched', async () => {
    db.thread.findUnique.mockResolvedValue({ source: 'discord', sourceId: 'discord:channel-123' });
    db.message.findFirst.mockResolvedValueOnce({ content: 'Hello', createdAt: new Date() }).mockResolvedValueOnce(null);
    const client = {
      channels: { fetch: vi.fn().mockRejectedValue(new Error('Unknown Channel')) },
    } as unknown as Client;
    const ctx = makeCtx(db);

    await expect(sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage })).resolves.toBeUndefined();
    expect(ctx.logger.warn as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(expect.stringContaining('failed to fetch channel'));
  });

  it('warns and returns when the channel is not sendable', async () => {
    db.thread.findUnique.mockResolvedValue({ source: 'discord', sourceId: 'discord:channel-123' });
    db.message.findFirst.mockResolvedValueOnce({ content: 'Hello', createdAt: new Date() }).mockResolvedValueOnce(null);
    const unsendableChannel = { isSendable: () => false };
    const client = makeClient(unsendableChannel as ReturnType<typeof makeSendableChannel>);
    const ctx = makeCtx(db);

    await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

    expect(ctx.logger.warn as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(expect.stringContaining('channel is not sendable'));
  });

  it('sends multiple chunks when splitMessage returns more than one', async () => {
    db.thread.findUnique.mockResolvedValue({ source: 'discord', sourceId: 'discord:channel-123' });
    db.message.findFirst.mockResolvedValueOnce({ content: 'chunk1\nchunk2', createdAt: new Date() }).mockResolvedValueOnce(null);
    const channel = makeSendableChannel();
    const client = makeClient(channel);
    const ctx = makeCtx(db);
    const multiSplit = (_content: string) => ['chunk1', 'chunk2'];

    await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage: multiSplit });

    expect(channel.send).toHaveBeenCalledTimes(2);
    expect(channel.send).toHaveBeenNthCalledWith(1, 'chunk1');
    expect(channel.send).toHaveBeenNthCalledWith(2, 'chunk2');
  });

  it('warns when sourceId does not contain a valid channel ID', async () => {
    db.thread.findUnique.mockResolvedValue({ source: 'discord', sourceId: 'web:something' });
    db.message.findFirst.mockResolvedValueOnce({ content: 'Hello', createdAt: new Date() }).mockResolvedValueOnce(null);
    const client = makeClient();
    const ctx = makeCtx(db);

    await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

    expect(ctx.logger.warn as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(expect.stringContaining('could not extract channel ID'));
    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it('skips delivery when pipeline error is newer than last assistant message', async () => {
    db.thread.findUnique.mockResolvedValue({ source: 'discord', sourceId: 'discord:channel-123' });
    db.message.findFirst
      .mockResolvedValueOnce({ content: 'old response', createdAt: new Date('2026-01-01T00:00:00Z') })
      .mockResolvedValueOnce({ createdAt: new Date('2026-01-01T00:01:00Z') });
    const channel = makeSendableChannel();
    const client = makeClient(channel);
    const ctx = makeCtx(db);

    await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

    expect(channel.send).not.toHaveBeenCalled();
  });

  it('delivers when pipeline error is older than last assistant message', async () => {
    db.thread.findUnique.mockResolvedValue({ source: 'discord', sourceId: 'discord:channel-123' });
    db.message.findFirst
      .mockResolvedValueOnce({ content: 'new response', createdAt: new Date('2026-01-01T00:02:00Z') })
      .mockResolvedValueOnce({ createdAt: new Date('2026-01-01T00:01:00Z') });
    const channel = makeSendableChannel();
    const client = makeClient(channel);
    const ctx = makeCtx(db);

    await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

    expect(channel.send).toHaveBeenCalledWith('new response');
  });

  it('propagates error when channel.send rejects mid-delivery', async () => {
    db.thread.findUnique.mockResolvedValue({ source: 'discord', sourceId: 'discord:channel-123' });
    db.message.findFirst.mockResolvedValueOnce({ content: 'chunk1\nchunk2\nchunk3', createdAt: new Date() }).mockResolvedValueOnce(null);
    const channel = makeSendableChannel();
    channel.send
      .mockResolvedValueOnce(undefined) // chunk 1 succeeds
      .mockRejectedValueOnce(new Error('Rate limited')); // chunk 2 fails
    const client = makeClient(channel);
    const ctx = makeCtx(db);
    const multiSplit = (_content: string) => ['chunk1', 'chunk2', 'chunk3'];

    await expect(sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage: multiSplit })).rejects.toThrow('Rate limited');

    // Only first chunk was sent before error
    expect(channel.send).toHaveBeenCalledTimes(2);
    expect(channel.send).toHaveBeenNthCalledWith(1, 'chunk1');
    expect(channel.send).toHaveBeenNthCalledWith(2, 'chunk2');
  });

  it('delivers when no pipeline error exists', async () => {
    db.thread.findUnique.mockResolvedValue({ source: 'discord', sourceId: 'discord:channel-123' });
    db.message.findFirst.mockResolvedValueOnce({ content: 'response', createdAt: new Date() }).mockResolvedValueOnce(null);
    const channel = makeSendableChannel();
    const client = makeClient(channel);
    const ctx = makeCtx(db);

    await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

    expect(channel.send).toHaveBeenCalledWith('response');
  });

  describe('metadata-based routing (primary thread)', () => {
    it('delivers reply when the triggering user message has discordChannelId metadata', async () => {
      db.thread.findUnique.mockResolvedValue({ source: 'system', sourceId: 'primary' });
      const assistantAt = new Date('2026-01-01T00:01:00Z');
      db.message.findFirst.mockResolvedValueOnce({ content: 'Hello from Claude', createdAt: assistantAt }).mockResolvedValueOnce(null); // no pipeline error
      db.message.findMany.mockResolvedValue([{ metadata: { discordChannelId: 'discord:dm-chan-456' }, createdAt: new Date('2026-01-01T00:00:30Z') }]);
      const channel = makeSendableChannel();
      const client = makeClient(channel);
      const ctx = makeCtx(db);

      await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

      expect(client.channels.fetch).toHaveBeenCalledWith('dm-chan-456');
      expect(channel.send).toHaveBeenCalledWith('Hello from Claude');
    });

    it('does not deliver when user message has no discordChannelId metadata', async () => {
      db.thread.findUnique.mockResolvedValue({ source: 'system', sourceId: 'primary' });
      const assistantAt = new Date('2026-01-01T00:01:00Z');
      db.message.findFirst.mockResolvedValueOnce({ content: 'Hello', createdAt: assistantAt }).mockResolvedValueOnce(null);
      db.message.findMany.mockResolvedValue([{ metadata: {}, createdAt: new Date('2026-01-01T00:00:30Z') }]);
      const channel = makeSendableChannel();
      const client = makeClient(channel);
      const ctx = makeCtx(db);

      await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

      expect(client.channels.fetch).not.toHaveBeenCalled();
    });

    it('does not deliver when no recent user messages exist', async () => {
      db.thread.findUnique.mockResolvedValue({ source: 'system', sourceId: 'primary' });
      db.message.findFirst.mockResolvedValueOnce({ content: 'Hello', createdAt: new Date() }).mockResolvedValueOnce(null);
      db.message.findMany.mockResolvedValue([]);
      const channel = makeSendableChannel();
      const client = makeClient(channel);
      const ctx = makeCtx(db);

      await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

      expect(client.channels.fetch).not.toHaveBeenCalled();
    });

    it('skips delivery when pipeline error is newer than assistant message (metadata path)', async () => {
      db.thread.findUnique.mockResolvedValue({ source: 'system', sourceId: 'primary' });
      db.message.findFirst
        .mockResolvedValueOnce({ content: 'old', createdAt: new Date('2026-01-01T00:00:00Z') })
        .mockResolvedValueOnce({ createdAt: new Date('2026-01-01T00:01:00Z') }); // pipeline error newer
      db.message.findMany.mockResolvedValue([{ metadata: { discordChannelId: 'discord:dm-chan-456' }, createdAt: new Date('2026-01-01T00:00:00Z') }]);
      const channel = makeSendableChannel();
      const client = makeClient(channel);
      const ctx = makeCtx(db);

      await sendDiscordReply({ client, ctx, threadId: 'thread-1', splitMessage });

      expect(channel.send).not.toHaveBeenCalled();
    });
  });
});
