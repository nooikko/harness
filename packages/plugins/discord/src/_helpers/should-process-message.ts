// Should process message — determines whether a Discord message should enter the pipeline

import type { Message as DiscordMessage } from 'discord.js';

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
