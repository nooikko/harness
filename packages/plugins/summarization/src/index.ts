// Summarization plugin — periodically summarizes thread history to prevent token overflow

import type { PluginContext, PluginDefinition } from '@harness/plugin-contract';
import { countThreadMessages } from './_helpers/count-thread-messages';
import { generateSummary } from './_helpers/generate-summary';

const SUMMARY_TRIGGER_COUNT = 50;
const DUPLICATE_GUARD_MS = 60_000;

type SummarizeInBackground = (ctx: PluginContext, threadId: string, messageCount: number) => Promise<void>;

const summarizeInBackground: SummarizeInBackground = async (ctx, threadId, messageCount) => {
  try {
    // Duplicate guard: skip if a summary was created within the last 60s
    const recentSummary = await ctx.db.message.findFirst({
      where: { threadId, kind: 'summary' },
      orderBy: { createdAt: 'desc' },
    });
    if (recentSummary && Date.now() - recentSummary.createdAt.getTime() < DUPLICATE_GUARD_MS) {
      return;
    }

    const summaryContent = await generateSummary(ctx, threadId, messageCount);

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
  register: async (ctx) => {
    ctx.logger.info('Summarization plugin registered');

    return {
      onAfterInvoke: async (threadId) => {
        const count = await countThreadMessages(ctx.db, threadId);
        if (count > 0 && count % SUMMARY_TRIGGER_COUNT === 0) {
          // Fire-and-forget — do NOT await
          void summarizeInBackground(ctx, threadId, count);
        }
      },
    };
  },
};
