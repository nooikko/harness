// Search indexing plugin — indexes messages and threads into Qdrant for semantic search
// Hooks: onMessage (index user messages), onPipelineComplete (index assistant responses + thread)
// Lifecycle: start (ensure collections + backfill)

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import type { QdrantClient } from '@harness/vector-search';
import { ensureCollections, getQdrantClient } from '@harness/vector-search';
import { backfill } from './_helpers/backfill.js';
import { indexMessage } from './_helpers/index-message.js';
import { indexThread } from './_helpers/index-thread.js';

type IndexInBackground = (ctx: PluginContext, qdrant: QdrantClient, fn: () => Promise<void>) => void;

const indexInBackground: IndexInBackground = (ctx, _qdrant, fn) => {
  void (async () => {
    try {
      await fn();
    } catch (err) {
      ctx.logger.warn(`search: indexing failed: ${err}`);
    }
  })();
};

export const plugin: PluginDefinition = {
  name: 'search',
  version: '1.0.0',
  start: async (ctx: PluginContext) => {
    const qdrant = getQdrantClient();
    if (!qdrant) {
      ctx.logger.info('search: QDRANT_URL not configured, plugin disabled');
      return;
    }

    await ensureCollections(qdrant);
    ctx.logger.info('search: Qdrant collections ready');

    // Fire-and-forget backfill on startup
    void (async () => {
      try {
        await backfill(qdrant, ctx.db, ctx.logger);
      } catch (err) {
        ctx.logger.warn(`search: backfill failed: ${err}`);
      }
    })();
  },
  register: async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Search indexing plugin registered');

    return {
      onMessage: async (threadId, role, content) => {
        const qdrant = getQdrantClient();
        if (!qdrant) {
          return;
        }

        // Only index user messages — assistant messages are indexed via onPipelineComplete
        if (role !== 'user') {
          return;
        }

        // Find the message just persisted (most recent user message in thread)
        const message = await ctx.db.message.findFirst({
          where: { threadId, role: 'user' },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });

        if (!message) {
          return;
        }

        indexInBackground(ctx, qdrant, () => indexMessage(qdrant, ctx.db, message.id));
      },

      onPipelineComplete: async (threadId, result) => {
        const qdrant = getQdrantClient();
        if (!qdrant) {
          return;
        }

        // Index the assistant response if it produced text output
        if (result.invokeResult?.output) {
          const assistantMsg = await ctx.db.message.findFirst({
            where: { threadId, role: 'assistant', kind: 'text' },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });

          if (assistantMsg) {
            indexInBackground(ctx, qdrant, () => indexMessage(qdrant, ctx.db, assistantMsg.id));
          }
        }

        // Re-index the thread (name may have been updated by auto-namer)
        indexInBackground(ctx, qdrant, () => indexThread(qdrant, ctx.db, threadId));
      },
    };
  },
};
