// Discord plugin — registers as a message source and reply sink via Discord.js

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { toPipelineMessage } from './_helpers/message-adapter';
import { parseAllowedChannels } from './_helpers/parse-allowed-channels';
import { sendDiscordReply } from './_helpers/send-discord-reply';
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

const DISCORD_MAX_LENGTH = 2000;

type SplitMessage = (content: string) => string[];

export const splitMessage: SplitMessage = (content) => {
  if (!content.trim()) {
    return [];
  }

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

// Shared mutable state resolved during register(), used by start() and onSettingsChange()
let resolvedToken: string | undefined;
let allowedChannels: Set<string> = new Set();
let defaultAgentId: string | undefined;

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Discord plugin registered');

    const settings = await ctx.getSettings(settingsSchema);
    resolvedToken = settings.botToken ?? ctx.config.discordToken;
    allowedChannels = parseAllowedChannels(settings.allowedChannelIds);

    // Cache default agent for thread creation (avoid per-message DB lookup)
    const defaultAgent = await ctx.db.agent.findFirst({ where: { slug: 'default', enabled: true }, select: { id: true } });
    defaultAgentId = defaultAgent?.id;

    const hooks: PluginHooks = {
      onBroadcast: async (event, data) => {
        if (event !== 'pipeline:complete') {
          return;
        }
        if (!state.client || !state.connected) {
          return;
        }
        const { threadId } = data as { threadId: string };
        try {
          await sendDiscordReply({ client: state.client, ctx, threadId, splitMessage });
        } catch (err) {
          ctx.logger.error(`discord: failed to deliver reply [thread=${threadId}]: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
      onSettingsChange: async (pluginName: string) => {
        if (pluginName !== 'discord') {
          return;
        }
        const newSettings = await ctx.getSettings(settingsSchema);
        allowedChannels = parseAllowedChannels(newSettings.allowedChannelIds);

        // Re-cache default agent in case it changed
        const freshAgent = await ctx.db.agent.findFirst({ where: { slug: 'default', enabled: true }, select: { id: true } });
        defaultAgentId = freshAgent?.id;

        const newToken = newSettings.botToken ?? ctx.config.discordToken;

        // Destroy existing client before reconnecting or disconnecting
        if (state.client) {
          await state.client.destroy();
          state.client = null;
          state.connected = false;
        }

        if (newToken) {
          resolvedToken = newToken;
          await start(ctx);
          ctx.logger.info('Discord: reconnected with updated token');
        } else {
          // Token was cleared — stay disconnected
          resolvedToken = undefined;
          ctx.logger.info('Discord: bot token removed, disconnected');
          ctx.reportStatus('degraded', 'No bot token configured');
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
    ctx.reportStatus('degraded', 'No bot token configured');
    return;
  }

  const client = createClient(ctx);
  state.client = client;

  client.once(Events.ClientReady, (readyClient) => {
    state.connected = true;
    ctx.logger.info(`Discord plugin: connected as ${readyClient.user.tag}`);
    ctx.reportStatus('healthy', `Connected as ${readyClient.user.tag}`);
    void ctx.broadcast('discord:connection', { connected: true, username: readyClient.user.tag }).catch((err) => {
      ctx.logger.warn(`discord: broadcast failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  });

  client.on(Events.ShardDisconnect, () => {
    state.connected = false;
    ctx.logger.warn('Discord plugin: disconnected from gateway');
    ctx.reportStatus('error', 'Disconnected from gateway');
    void ctx.broadcast('discord:connection', { connected: false }).catch((err) => {
      ctx.logger.warn(`discord: broadcast failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  });

  client.on(Events.ShardReconnecting, () => {
    ctx.logger.info('Discord plugin: reconnecting to gateway...');
    ctx.reportStatus('degraded', 'Reconnecting to gateway...');
  });

  client.on(Events.ShardResume, () => {
    state.connected = true;
    ctx.logger.info('Discord plugin: reconnected to gateway');
    ctx.reportStatus('healthy', 'Reconnected to gateway');
    void ctx.broadcast('discord:connection', { connected: true }).catch((err) => {
      ctx.logger.warn(`discord: broadcast failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  });

  // Register message listener
  client.on(Events.MessageCreate, async (message) => {
    const botUserId = client.user?.id;
    if (!botUserId) {
      return;
    }

    if (!shouldProcessMessage(message, botUserId, allowedChannels)) {
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
          ...(defaultAgentId ? { agent: { connect: { id: defaultAgentId } } } : {}),
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

      // Run the Claude pipeline — fire-and-forget, same pattern as web plugin
      void ctx.sendToThread(thread.id, pipelineMsg.content).catch((err) => {
        ctx.logger.error(`discord: pipeline failed [thread=${thread.id}]: ${err instanceof Error ? err.message : String(err)}`);
      });

      // Feed into pipeline via broadcast
      await ctx.broadcast('discord:message', {
        threadId: thread.id,
        sourceId: pipelineMsg.sourceId,
        content: pipelineMsg.content,
        authorName: pipelineMsg.authorName,
      });
    } catch (err) {
      // P2002 = unique constraint: concurrent upsert race on same channel
      const isPrismaUnique = err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002';
      if (isPrismaUnique) {
        ctx.logger.debug(`Discord plugin: upsert race on thread, re-fetching [source=${pipelineMsg.sourceId}]`);
        try {
          const existing = await ctx.db.thread.findUnique({
            where: { source_sourceId: { source: 'discord', sourceId: pipelineMsg.sourceId } },
          });
          if (existing) {
            await ctx.db.message.create({
              data: { threadId: existing.id, role: 'user', content: pipelineMsg.content },
            });

            // Run the Claude pipeline — fire-and-forget, same pattern as web plugin
            void ctx.sendToThread(existing.id, pipelineMsg.content).catch((err) => {
              ctx.logger.error(`discord: pipeline failed [thread=${existing.id}]: ${err instanceof Error ? err.message : String(err)}`);
            });

            await ctx.broadcast('discord:message', {
              threadId: existing.id,
              sourceId: pipelineMsg.sourceId,
              content: pipelineMsg.content,
              authorName: pipelineMsg.authorName,
            });
          }
        } catch (retryErr) {
          ctx.logger.error(`Discord plugin: retry after race failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
        }
      } else {
        ctx.logger.error(`Discord plugin: failed to process message: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  });

  try {
    await client.login(token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.logger.error(`Discord plugin: failed to connect: ${msg}`);
    state.connected = false;
    ctx.reportStatus('error', `Login failed: ${msg}`);
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

export const plugin: PluginDefinition = {
  name: 'discord',
  version: '1.0.0',
  register: createRegister(),
  start,
  stop,
  settingsSchema,
};
