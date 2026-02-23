// Extract channel ID — parses a Discord channel ID from a sourceId string

type ExtractChannelId = (sourceId: string) => string | null;

export const extractChannelId: ExtractChannelId = (sourceId) => {
  if (!sourceId.startsWith('discord:')) {
    return null;
  }
  return sourceId.slice('discord:'.length);
};
