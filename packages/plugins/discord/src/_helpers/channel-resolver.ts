// Channel resolver — maps Discord channels/threads to sourceIds for pipeline routing

import type { Channel, ThreadChannel } from "discord.js";

export type ResolvedChannel = {
  sourceId: string;
  channelName: string;
  isThread: boolean;
  parentChannelId: string | null;
};

type ResolveChannel = (channel: Channel) => ResolvedChannel;

export const resolveChannel: ResolveChannel = (channel) => {
  const isThread = channel.isThread();

  if (isThread) {
    const thread = channel as ThreadChannel;
    return {
      sourceId: `discord:${thread.id}`,
      channelName: thread.name ?? `thread-${thread.id}`,
      isThread: true,
      parentChannelId: thread.parentId,
    };
  }

  return {
    sourceId: `discord:${channel.id}`,
    channelName: "name" in channel ? (channel.name as string) : channel.id,
    isThread: false,
    parentChannelId: null,
  };
};

type BuildSourceId = (channelId: string) => string;

export const buildSourceId: BuildSourceId = (channelId) => {
  return `discord:${channelId}`;
};

type ExtractChannelId = (sourceId: string) => string | null;

export const extractChannelId: ExtractChannelId = (sourceId) => {
  if (!sourceId.startsWith("discord:")) {
    return null;
  }
  return sourceId.slice("discord:".length);
};
