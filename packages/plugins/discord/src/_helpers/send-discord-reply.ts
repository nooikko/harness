// Send Discord reply — delivers an assistant response to the originating Discord channel

import type { PluginContext } from '@harness/plugin-contract';
import type { Client } from 'discord.js';
import { extractChannelId } from './extract-channel-id';

type SendDiscordReply = (params: {
  client: Client;
  ctx: PluginContext;
  threadId: string;
  splitMessage: (content: string) => string[];
}) => Promise<void>;

export const sendDiscordReply: SendDiscordReply = async ({ client, ctx, threadId, splitMessage }) => {
  // Look up the thread to check if it originated from Discord
  const thread = await ctx.db.thread.findUnique({
    where: { id: threadId },
    select: { source: true, sourceId: true },
  });

  if (!thread || thread.source !== 'discord') {
    return;
  }

  const channelId = extractChannelId(thread.sourceId);
  if (!channelId) {
    ctx.logger.warn(`discord: could not extract channel ID from sourceId [sourceId=${thread.sourceId}]`);
    return;
  }

  // Fetch the most recent assistant message for this thread
  const message = await ctx.db.message.findFirst({
    where: { threadId, role: 'assistant', kind: 'text' },
    orderBy: { createdAt: 'desc' },
    select: { content: true },
  });

  if (!message?.content) {
    ctx.logger.debug(`discord: no assistant message to deliver [thread=${threadId}]`);
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
  const chunks = splitMessage(message.content);
  for (const chunk of chunks) {
    await channel.send(chunk);
  }
};
