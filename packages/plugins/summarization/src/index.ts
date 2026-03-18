// Summarization plugin — periodically summarizes thread history to prevent token overflow

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { countThreadMessages } from './_helpers/count-thread-messages';
import { generateSummary } from './_helpers/generate-summary';
import { settingsSchema } from './_helpers/settings-schema';

const DEFAULT_TRIGGER_COUNT = 50;
const DEFAULT_DUPLICATE_GUARD_SECONDS = 60;

type SummarizeInBackground = (
  ctx: PluginContext,
  threadId: string,
  messageCount: number,
  duplicateGuardMs: number,
  customPrompt?: string,
  model?: string,
) => Promise<void>;

const summarizeInBackground: SummarizeInBackground = async (ctx, threadId, messageCount, duplicateGuardMs, customPrompt, model) => {
  try {
    // Duplicate guard: skip if a summary was created within the guard window
    const recentSummary = await ctx.db.message.findFirst({
      where: {
        threadId,
        kind: 'summary',
        createdAt: { gte: new Date(Date.now() - duplicateGuardMs) },
      },
    });
    if (recentSummary) {
      return;
    }

    const summaryContent = await generateSummary(ctx, threadId, messageCount, customPrompt, model);

    await ctx.db.message.create({
      data: {
        threadId,
        role: 'assistant',
        kind: 'summary',
        content: summaryContent,
        metadata: {
          coverageMessageCount: messageCount,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    ctx.logger.warn('summarization failed', {
      threadId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const plugin: PluginDefinition = {
  name: 'summarization',
  version: '1.0.0',
  settingsSchema,
  register: async (ctx) => {
    ctx.logger.info('Summarization plugin registered');

    let settings = await ctx.getSettings(settingsSchema);

    const hooks: PluginHooks = {
      onSettingsChange: async (pluginName: string) => {
        if (pluginName !== 'summarization') {
          return;
        }
        settings = await ctx.getSettings(settingsSchema);
        ctx.logger.info('Summarization plugin: settings reloaded');
      },

      onAfterInvoke: async (threadId) => {
        const triggerCount = settings.triggerCount ?? DEFAULT_TRIGGER_COUNT;
        const duplicateGuardMs = (settings.duplicateGuardSeconds ?? DEFAULT_DUPLICATE_GUARD_SECONDS) * 1000;

        const count = await countThreadMessages(ctx.db, threadId);
        if (count > 0 && (count + 1) % triggerCount === 0) {
          // Fire-and-forget — do NOT await
          void summarizeInBackground(ctx, threadId, count, duplicateGuardMs, settings.customPrompt, settings.model);
        }
      },
    };

    return hooks;
  },
};
