// Audit plugin — extracts thread conversation into a ThreadAudit record then hard-deletes the thread
// Hook: onBroadcast — listens for 'audit:requested' event

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { buildExtractionPrompt } from './_helpers/build-extraction-prompt';

type DeleteThreadSafely = (ctx: PluginContext, threadId: string) => Promise<void>;

const deleteThreadSafely: DeleteThreadSafely = async (ctx, threadId) => {
  // Detach child threads first (self-referential FK)
  await ctx.db.thread.updateMany({
    where: { parentThreadId: threadId },
    data: { parentThreadId: null },
  });
  await ctx.db.thread.delete({ where: { id: threadId } });
};

type RunAuditInBackground = (ctx: PluginContext, threadId: string) => Promise<void>;

const runAuditInBackground: RunAuditInBackground = async (ctx, threadId) => {
  try {
    // Load thread metadata
    const thread = await ctx.db.thread.findUnique({
      where: { id: threadId },
      select: { name: true, source: true, kind: true },
    });

    // Load text messages (cap at 200 for token limits)
    const messages = await ctx.db.message.findMany({
      where: { threadId, kind: 'text', role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { role: true, content: true },
    });

    if (messages.length === 0) {
      // Nothing to extract — just delete
      await deleteThreadSafely(ctx, threadId);
      await ctx.broadcast('thread:deleted', { threadId });
      return;
    }

    const prompt = buildExtractionPrompt(messages);
    const result = await ctx.invoker.invoke(prompt, { model: 'claude-haiku-4-5-20251001' });

    await ctx.db.threadAudit.create({
      data: {
        threadId,
        threadName: thread?.name ?? null,
        content: result.output ?? '(no extraction output)',
        metadata: { messageCount: messages.length },
      },
    });

    await deleteThreadSafely(ctx, threadId);
    await ctx.broadcast('thread:deleted', { threadId });
  } catch (err) {
    ctx.logger.error(`audit: failed [thread=${threadId}]: ${err}`);
    await ctx.broadcast('audit:failed', { threadId, reason: String(err) });
  }
};

export const plugin: PluginDefinition = {
  name: 'audit',
  version: '1.0.0',
  register: async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Audit plugin registered');

    return {
      onBroadcast: async (event, data) => {
        if (event !== 'audit:requested') {
          return;
        }
        const { threadId } = data as { threadId: string };

        // Duplicate guard: skip if an audit was already created in last 60 seconds
        const recent = await ctx.db.threadAudit.findFirst({
          where: {
            threadId,
            extractedAt: { gte: new Date(Date.now() - 60_000) },
          },
        });
        if (recent) {
          return;
        }

        void runAuditInBackground(ctx, threadId);
      },
    };
  },
};
