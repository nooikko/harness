// Build source ID — creates a sourceId string from a Discord channel ID

type BuildSourceId = (channelId: string) => string;

export const buildSourceId: BuildSourceId = (channelId) => {
  return `discord:${channelId}`;
};
