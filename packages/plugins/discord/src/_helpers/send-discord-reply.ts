// Send Discord reply — delivers an assistant response to the originating Discord channel
// Supports two routing modes:
// 1. Thread-source routing: thread.source === 'discord' (guild channel threads)
// 2. Metadata routing: user message has discordChannelId in metadata (DMs routed to primary thread)

import type { PluginContext } from '@harness/plugin-contract';
import type { Client } from 'discord.js';
import { extractChannelId } from './extract-channel-id';

type SendDiscordReply = (params: {
  client: Client;
  ctx: PluginContext;
  threadId: string;
  splitMessage: (content: string) => string[];
}) => Promise<void>;

type ResolveDiscordChannelId = (params: {
  ctx: PluginContext;
  threadId: string;
  thread: { source: string | null; sourceId: string | null };
  assistantCreatedAt: Date;
}) => Promise<string | null>;

const resolveDiscordChannelId: ResolveDiscordChannelId = async ({ ctx, threadId, thread, assistantCreatedAt }) => {
  // Path 1: Thread-source routing (guild channel threads with source: 'discord')
  if (thread.source === 'discord' && thread.sourceId) {
    return extractChannelId(thread.sourceId);
  }

  // Path 2: Metadata routing — check the most recent user message before the assistant response
  // for a discordChannelId tag. This handles DMs routed to the primary thread.
  const recentUserMessages = await ctx.db.message.findMany({
    where: {
      threadId,
      role: 'user',
      createdAt: { lte: assistantCreatedAt },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { metadata: true, createdAt: true },
  });

  const triggeringMessage = recentUserMessages[0];
  if (!triggeringMessage) {
    return null;
  }

  const metadata = triggeringMessage.metadata as Record<string, unknown> | null;
  const discordChannelId = metadata?.discordChannelId;
  if (typeof discordChannelId !== 'string') {
    return null;
  }

  return extractChannelId(discordChannelId);
};

export const sendDiscordReply: SendDiscordReply = async ({ client, ctx, threadId, splitMessage }) => {
  const thread = await ctx.db.thread.findUnique({
    where: { id: threadId },
    select: { source: true, sourceId: true },
  });

  if (!thread) {
    return;
  }

  // Fetch the most recent assistant message and most recent pipeline error in parallel
  const [assistantMsg, pipelineError] = await Promise.all([
    ctx.db.message.findFirst({
      where: { threadId, role: 'assistant', kind: 'text' },
      orderBy: { createdAt: 'desc' },
      select: { content: true, createdAt: true },
    }),
    ctx.db.message.findFirst({
      where: {
        threadId,
        role: 'system',
        kind: 'status',
        metadata: { path: ['event'], equals: 'pipeline_error' },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  if (!assistantMsg?.content) {
    ctx.logger.debug(`discord: no assistant message to deliver [thread=${threadId}]`);
    return;
  }

  // Skip delivery if a pipeline error occurred after the last assistant message
  if (pipelineError && pipelineError.createdAt >= assistantMsg.createdAt) {
    ctx.logger.debug(`discord: skipping delivery — pipeline errored after last assistant message [thread=${threadId}]`);
    return;
  }

  // Resolve the Discord channel ID via thread-source or message-metadata routing
  const channelId = await resolveDiscordChannelId({
    ctx,
    threadId,
    thread,
    assistantCreatedAt: assistantMsg.createdAt,
  });

  if (!channelId) {
    if (thread.source === 'discord') {
      ctx.logger.warn(`discord: could not extract channel ID from sourceId [sourceId=${thread.sourceId}]`);
    }
    return;
  }

  // Resolve the Discord channel
  let channel: Awaited<ReturnType<typeof client.channels.fetch>>;
  try {
    channel = await client.channels.fetch(channelId);
  } catch (err) {
    ctx.logger.warn(`discord: failed to fetch channel [channelId=${channelId}]: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  if (!channel || !channel.isSendable()) {
    ctx.logger.warn(`discord: channel is not sendable [channelId=${channelId}]`);
    return;
  }

  // Split and send each chunk in sequence
  const chunks = splitMessage(assistantMsg.content);
  for (const chunk of chunks) {
    await channel.send(chunk);
  }
};
