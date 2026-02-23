// Message adapter — converts Discord.js messages into pipeline-compatible format

import type { Message as DiscordMessage } from "discord.js";
import { resolveChannel } from "./channel-resolver";

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

type ShouldProcessMessage = (message: DiscordMessage, botUserId: string) => boolean;

export const shouldProcessMessage: ShouldProcessMessage = (message, botUserId) => {
  // Ignore messages from bots (including ourselves)
  if (message.author.bot) {
    return false;
  }

  // Process if the bot is directly mentioned
  if (message.mentions.users.has(botUserId)) {
    return true;
  }

  // Process DMs (messages not in a guild)
  if (!message.guild) {
    return true;
  }

  return false;
};

type StripMentions = (content: string, botUserId: string) => string;

export const stripMentions: StripMentions = (content, botUserId) => {
  // Remove the bot's mention tag from content for cleaner pipeline input
  const mentionPattern = new RegExp(`<@!?${botUserId}>\\s*`, "g");
  return content.replace(mentionPattern, "").trim();
};

type ToPipelineMessage = (message: DiscordMessage) => PipelineMessage;

export const toPipelineMessage: ToPipelineMessage = (message) => {
  const resolved = resolveChannel(message.channel);

  return {
    threadId: "", // Will be resolved by orchestrator thread lookup/creation
    sourceId: resolved.sourceId,
    role: "user",
    content: message.content,
    authorId: message.author.id,
    authorName: message.author.displayName ?? message.author.username,
    channelName: resolved.channelName,
    isThread: resolved.isThread,
  };
};
