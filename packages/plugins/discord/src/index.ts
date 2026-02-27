// Discord plugin — registers as a message source and reply sink via Discord.js

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { Client, Events, GatewayIntentBits, type TextChannel } from 'discord.js';
import { extractChannelId } from './_helpers/extract-channel-id';
import { toPipelineMessage } from './_helpers/message-adapter';
import { settingsSchema } from './_helpers/settings-schema';
import { shouldProcessMessage } from './_helpers/should-process-message';
import { stripMentions } from './_helpers/strip-mentions';

export type DiscordPluginState = {
  client: Client | null;
  connected: boolean;
};

type CreateClient = (ctx: PluginContext) => Client;

const createClient: CreateClient = (ctx) => {
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages];

  const client = new Client({ intents });

  client.on(Events.Error, (error) => {
    ctx.logger.error(`Discord client error: ${error.message}`);
  });

  client.on(Events.Warn, (warning) => {
    ctx.logger.warn(`Discord client warning: ${warning}`);
  });

  return client;
};

type SendDiscordMessage = (client: Client, sourceId: string, content: string, ctx: PluginContext) => Promise<void>;

const sendDiscordMessage: SendDiscordMessage = async (client, sourceId, content, ctx) => {
  const channelId = extractChannelId(sourceId);
  if (!channelId) {
    ctx.logger.warn(`Cannot send message: invalid sourceId "${sourceId}"`);
    return;
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel) {
    ctx.logger.warn(`Cannot send message: channel "${channelId}" not found`);
    return;
  }

  if (!channel.isTextBased()) {
    ctx.logger.warn(`Cannot send message: channel "${channelId}" is not text-based`);
    return;
  }

  // Split long messages into Discord-compliant chunks (2000 char limit)
  const chunks = splitMessage(content);
  for (const chunk of chunks) {
    await (channel as TextChannel).send(chunk);
  }
};

const DISCORD_MAX_LENGTH = 2000;

type SplitMessage = (content: string) => string[];

export const splitMessage: SplitMessage = (content) => {
  if (content.length <= DISCORD_MAX_LENGTH) {
    return [content];
  }

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= DISCORD_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline before the limit
    let splitIndex = remaining.lastIndexOf('\n', DISCORD_MAX_LENGTH);

    // If no newline found, try splitting at a space
    if (splitIndex === -1 || splitIndex === 0) {
      splitIndex = remaining.lastIndexOf(' ', DISCORD_MAX_LENGTH);
    }

    // If still no good split point, hard split at the limit
    if (splitIndex === -1 || splitIndex === 0) {
      splitIndex = DISCORD_MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
};

// Shared mutable token resolved during register(), used by start() and onSettingsChange()
let resolvedToken: string | undefined;

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Discord plugin registered');

    const settings = await ctx.getSettings(settingsSchema);
    resolvedToken = settings.botToken ?? ctx.config.discordToken;

    const hooks: PluginHooks = {
      onSettingsChange: async (pluginName: string) => {
        if (pluginName !== 'discord') {
          return;
        }
        const newSettings = await ctx.getSettings(settingsSchema);
        const newToken = newSettings.botToken ?? ctx.config.discordToken;
        if (newToken) {
          resolvedToken = newToken;
          if (state.client) {
            await state.client.destroy();
            state.client = null;
            state.connected = false;
          }
          await start(ctx);
          ctx.logger.info('Discord: reconnected with updated token');
        }
      },
    };

    return hooks;
  };

  return register;
};

type StartDiscordPlugin = NonNullable<PluginDefinition['start']>;

const start: StartDiscordPlugin = async (ctx) => {
  const token = resolvedToken ?? ctx.config.discordToken;
  if (!token) {
    ctx.logger.warn('Discord plugin: DISCORD_TOKEN not set, skipping Discord connection');
    state.connected = false;
    return;
  }

  const client = createClient(ctx);
  state.client = client;

  client.once(Events.ClientReady, (readyClient) => {
    state.connected = true;
    ctx.logger.info(`Discord plugin: connected as ${readyClient.user.tag}`);
    void ctx.broadcast('discord:connection', { connected: true, username: readyClient.user.tag });
    void ctx.db.pluginConfig
      .update({
        where: { pluginName: 'discord' },
        data: { metadata: { connection: { connected: true, username: readyClient.user.tag } } },
      })
      .catch((err: unknown) => {
        ctx.logger.warn(`Discord plugin: failed to persist connection state: ${err instanceof Error ? err.message : String(err)}`);
      });
  });

  client.on(Events.ShardDisconnect, () => {
    state.connected = false;
    ctx.logger.warn('Discord plugin: disconnected from gateway');
    void ctx.broadcast('discord:connection', { connected: false });
    void ctx.db.pluginConfig
      .update({
        where: { pluginName: 'discord' },
        data: { metadata: { connection: { connected: false } } },
      })
      .catch((err: unknown) => {
        ctx.logger.warn(`Discord plugin: failed to persist connection state: ${err instanceof Error ? err.message : String(err)}`);
      });
  });

  client.on(Events.ShardReconnecting, () => {
    ctx.logger.info('Discord plugin: reconnecting to gateway...');
  });

  client.on(Events.ShardResume, () => {
    state.connected = true;
    ctx.logger.info('Discord plugin: reconnected to gateway');
    void ctx.broadcast('discord:connection', { connected: true });
    void ctx.db.pluginConfig
      .update({
        where: { pluginName: 'discord' },
        data: { metadata: { connection: { connected: true } } },
      })
      .catch((err: unknown) => {
        ctx.logger.warn(`Discord plugin: failed to persist connection state: ${err instanceof Error ? err.message : String(err)}`);
      });
  });

  // Register message listener
  client.on(Events.MessageCreate, async (message) => {
    const botUserId = client.user?.id;
    if (!botUserId) {
      return;
    }

    if (!shouldProcessMessage(message, botUserId)) {
      return;
    }

    const pipelineMsg = toPipelineMessage(message);
    pipelineMsg.content = stripMentions(pipelineMsg.content, botUserId);

    if (!pipelineMsg.content) {
      return;
    }

    ctx.logger.info(`Discord plugin: message from ${pipelineMsg.authorName} in ${pipelineMsg.channelName}`);

    try {
      // Find or create thread for this channel
      const thread = await ctx.db.thread.upsert({
        where: {
          source_sourceId: {
            source: 'discord',
            sourceId: pipelineMsg.sourceId,
          },
        },
        update: { lastActivity: new Date() },
        create: {
          source: 'discord',
          sourceId: pipelineMsg.sourceId,
          name: pipelineMsg.channelName,
          kind: 'general',
          status: 'active',
          lastActivity: new Date(),
        },
      });

      pipelineMsg.threadId = thread.id;

      // Persist the incoming message
      await ctx.db.message.create({
        data: {
          threadId: thread.id,
          role: 'user',
          content: pipelineMsg.content,
        },
      });

      // Feed into pipeline via broadcast
      await ctx.broadcast('discord:message', {
        threadId: thread.id,
        sourceId: pipelineMsg.sourceId,
        content: pipelineMsg.content,
        authorName: pipelineMsg.authorName,
      });
    } catch (err) {
      ctx.logger.error(`Discord plugin: failed to process message: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  try {
    await client.login(token);
  } catch (err) {
    ctx.logger.error(`Discord plugin: failed to connect: ${err instanceof Error ? err.message : String(err)}`);
    state.connected = false;
  }
};

type StopDiscordPlugin = NonNullable<PluginDefinition['stop']>;

const stop: StopDiscordPlugin = async (ctx) => {
  if (state.client) {
    ctx.logger.info('Discord plugin: disconnecting...');
    await state.client.destroy();
    state.client = null;
    state.connected = false;
    ctx.logger.info('Discord plugin: disconnected');
  }
};

const state: DiscordPluginState = {
  client: null,
  connected: false,
};

type GetSendMessage = (pluginState: DiscordPluginState, ctx: PluginContext) => (sourceId: string, content: string) => Promise<void>;

export const getSendMessage: GetSendMessage = (pluginState, ctx) => {
  return async (sourceId: string, content: string) => {
    if (!pluginState.client || !pluginState.connected) {
      ctx.logger.warn('Discord plugin: cannot send message, client not connected');
      return;
    }
    await sendDiscordMessage(pluginState.client, sourceId, content, ctx);
  };
};

export const plugin: PluginDefinition = {
  name: 'discord',
  version: '1.0.0',
  register: createRegister(),
  start,
  stop,
  settingsSchema,
};
