// Auto-namer plugin — generates a short thread title after the first user message
// Hook: onMessage — fires before invoke, starts name generation as background void

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { generateThreadName } from './_helpers/generate-thread-name';

type GenerateNameInBackground = (ctx: PluginContext, threadId: string, content: string) => Promise<void>;

const generateNameInBackground: GenerateNameInBackground = async (ctx, threadId, content) => {
  try {
    const name = await generateThreadName(ctx, content);
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
  register: async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Auto-namer plugin registered');

    return {
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
        if (count !== 1) {
          return;
        }

        // Fire and forget — runs in parallel with main pipeline
        void generateNameInBackground(ctx, threadId, content);
      },
    };
  },
};
