// Auto-namer plugin — generates a short thread title after the first user message
// Hook: onMessage — fires before invoke, starts name generation as background void

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { generateThreadName } from './_helpers/generate-thread-name';
import { settingsSchema } from './_helpers/settings-schema';

type GenerateNameInBackground = (ctx: PluginContext, threadId: string, content: string, customPrompt?: string) => Promise<void>;

const generateNameInBackground: GenerateNameInBackground = async (ctx, threadId, content, customPrompt) => {
  try {
    const name = await generateThreadName(ctx, content, customPrompt);
    if (!name) {
      return;
    }
    await ctx.db.thread.update({ where: { id: threadId }, data: { name } });
    await ctx.broadcast('thread:name-updated', { threadId, name });
  } catch (err) {
    ctx.logger.warn(`auto-namer: failed to generate name [thread=${threadId}]: ${err}`);
  }
};

export const plugin: PluginDefinition = {
  name: 'auto-namer',
  version: '1.0.0',
  settingsSchema,
  register: async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Auto-namer plugin registered');

    let settings = await ctx.getSettings(settingsSchema);

    return {
      onSettingsChange: async (pluginName: string) => {
        if (pluginName !== 'auto-namer') {
          return;
        }
        settings = await ctx.getSettings(settingsSchema);
        ctx.logger.info('Auto-namer plugin: settings reloaded');
      },

      onMessage: async (threadId, role, content) => {
        // Only process user messages
        if (role !== 'user') {
          return;
        }

        // Check if thread already has a custom name
        const thread = await ctx.db.thread.findUnique({
          where: { id: threadId },
          select: { name: true },
        });
        if (thread?.name && thread.name !== 'New Chat') {
          return;
        }

        // Only fire on first user message
        const count = await ctx.db.message.count({
          where: { threadId, role: 'user' },
        });
        if (count < 1) {
          return;
        }

        // Fire and forget — runs in parallel with main pipeline
        void generateNameInBackground(ctx, threadId, content, settings.customPrompt);
      },
    };
  },
};
