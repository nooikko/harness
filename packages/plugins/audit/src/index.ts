// Audit plugin — extracts thread conversation into a ThreadAudit record then hard-deletes the thread
// Hook: onBroadcast — listens for 'audit:requested' event

import type { InferSettings, PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { buildExtractionPrompt } from './_helpers/build-extraction-prompt';
import { type settingsFields, settingsSchema } from './_helpers/settings-schema';

const DEFAULT_MESSAGE_LIMIT = 200;
const DEFAULT_DUPLICATE_GUARD_SECONDS = 60;

// In-memory guard against concurrent audits on the same thread.
// The DB-based duplicate guard remains as a secondary check for process restarts.
export const activeAudits = new Set<string>();

type DeleteThreadSafely = (ctx: PluginContext, threadId: string) => Promise<void>;

const deleteThreadSafely: DeleteThreadSafely = async (ctx, threadId) => {
  // Detach child threads first (self-referential FK)
  await ctx.db.thread.updateMany({
    where: { parentThreadId: threadId },
    data: { parentThreadId: null },
  });
  // Null out CronJob references to prevent dangling threadIds
  await ctx.db.cronJob.updateMany({
    where: { threadId },
    data: { threadId: null },
  });
  try {
    await ctx.db.thread.delete({ where: { id: threadId } });
  } catch (err) {
    // Thread may already be deleted by a concurrent audit — treat as success
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Record to delete does not exist') || message.includes('RecordNotFound')) {
      ctx.logger.warn(`audit: thread already deleted [thread=${threadId}]`);
      return;
    }
    throw err;
  }
};

type RunAuditInBackground = (ctx: PluginContext, threadId: string, messageLimit: number) => Promise<void>;

const runAuditInBackground: RunAuditInBackground = async (ctx, threadId, messageLimit) => {
  try {
    // Load thread metadata
    const thread = await ctx.db.thread.findUnique({
      where: { id: threadId },
      select: { name: true, source: true, kind: true },
    });

    // Load text messages (capped at messageLimit for token limits)
    const messages = await ctx.db.message.findMany({
      where: { threadId, kind: 'text', role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'asc' },
      take: messageLimit,
      select: { role: true, content: true },
    });

    if (messages.length === 0) {
      // Nothing to extract — just delete
      await deleteThreadSafely(ctx, threadId);
      await ctx.broadcast('thread:deleted', { threadId });
      return;
    }

    const prompt = buildExtractionPrompt(messages);
    let extractedContent: string;
    try {
      const result = await ctx.invoker.invoke(prompt, { model: 'claude-haiku-4-5-20251001' });
      extractedContent = result.output ?? '(no extraction output)';
    } catch (invokeErr) {
      // Extraction failed — write a degraded audit record so the thread can still be deleted
      ctx.logger.warn(`audit: extraction failed, writing degraded record [thread=${threadId}]: ${invokeErr}`);
      extractedContent = `(extraction failed: ${invokeErr instanceof Error ? invokeErr.message : String(invokeErr)})`;
    }

    await ctx.db.threadAudit.create({
      data: {
        threadId,
        threadName: thread?.name ?? null,
        content: extractedContent,
        metadata: { messageCount: messages.length },
      },
    });

    await deleteThreadSafely(ctx, threadId);
    await ctx.broadcast('thread:deleted', { threadId });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    ctx.reportBackgroundError('audit-delete', error);
    await ctx.broadcast('audit:failed', { threadId, reason: String(err) });
  } finally {
    activeAudits.delete(threadId);
  }
};

let settings: InferSettings<typeof settingsFields> = {};

export const plugin: PluginDefinition = {
  name: 'audit',
  version: '1.0.0',
  settingsSchema,
  start: async (ctx: PluginContext): Promise<void> => {
    settings = await ctx.getSettings(settingsSchema);
  },
  register: async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Audit plugin registered');

    return {
      onSettingsChange: async (pluginName: string) => {
        if (pluginName !== 'audit') {
          return;
        }
        settings = await ctx.getSettings(settingsSchema);
        ctx.logger.info('Audit plugin: settings reloaded');
      },

      onBroadcast: async (event, data) => {
        if (event !== 'audit:requested') {
          return;
        }
        const { threadId } = data as { threadId: string };

        // In-memory guard: prevents concurrent fire-and-forget runs on the same thread
        if (activeAudits.has(threadId)) {
          return;
        }

        const duplicateGuardMs = (settings.duplicateGuardSeconds ?? DEFAULT_DUPLICATE_GUARD_SECONDS) * 1000;

        // DB-based duplicate guard: skip if an audit was already created within the guard window
        const recent = await ctx.db.threadAudit.findFirst({
          where: {
            threadId,
            extractedAt: { gte: new Date(Date.now() - duplicateGuardMs) },
          },
        });
        if (recent) {
          return;
        }

        activeAudits.add(threadId);
        const messageLimit = settings.messageLimit ?? DEFAULT_MESSAGE_LIMIT;
        void runAuditInBackground(ctx, threadId, messageLimit);
      },
    };
  },
};
