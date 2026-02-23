// Message adapter — converts Discord.js messages into pipeline-compatible format

import type { Message as DiscordMessage } from 'discord.js';
import { resolveChannel } from './channel-resolver';

export type PipelineMessage = {
  threadId: string;
  sourceId: string;
  role: string;
  content: string;
  authorId: string;
  authorName: string;
  channelName: string;
  isThread: boolean;
};

type ToPipelineMessage = (message: DiscordMessage) => PipelineMessage;

export const toPipelineMessage: ToPipelineMessage = (message) => {
  const resolved = resolveChannel(message.channel);

  return {
    threadId: '', // Will be resolved by orchestrator thread lookup/creation
    sourceId: resolved.sourceId,
    role: 'user',
    content: message.content,
    authorId: message.author.id,
    authorName: message.author.displayName ?? message.author.username,
    channelName: resolved.channelName,
    isThread: resolved.isThread,
  };
};
