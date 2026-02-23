// Strip mentions — removes the bot's mention tag from message content

type StripMentions = (content: string, botUserId: string) => string;

export const stripMentions: StripMentions = (content, botUserId) => {
  // Remove the bot's mention tag from content for cleaner pipeline input
  const mentionPattern = new RegExp(`<@!?${botUserId}>\\s*`, 'g');
  return content.replace(mentionPattern, '').trim();
};
