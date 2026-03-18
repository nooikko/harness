// Should process message — determines whether a Discord message should enter the pipeline

import type { Message as DiscordMessage } from 'discord.js';

type ShouldProcessMessage = (message: DiscordMessage, botUserId: string, allowedChannelIds?: Set<string>) => boolean;

export const shouldProcessMessage: ShouldProcessMessage = (message, botUserId, allowedChannelIds) => {
  // Ignore messages from bots (including ourselves)
  if (message.author.bot) {
    return false;
  }

  // Process DMs unconditionally (messages not in a guild)
  if (!message.guild) {
    return true;
  }

  // Guild messages require a direct mention
  if (!message.mentions.users.has(botUserId)) {
    return false;
  }

  // If an allow-list is configured, only process messages from listed channels
  if (allowedChannelIds && allowedChannelIds.size > 0 && !allowedChannelIds.has(message.channelId)) {
    return false;
  }

  return true;
};
