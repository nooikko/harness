// Search indexing plugin — indexes messages and threads into Qdrant for semantic search
// Hooks: onMessage (index user messages), onPipelineComplete (index assistant responses),
//        onBroadcast (re-index thread on name change)
// Lifecycle: start (ensure collections + backfill), stop (abort backfill)

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { ensureCollections, getQdrantClient } from '@harness/vector-search';
import { backfill } from './_helpers/backfill.js';
import { indexText } from './_helpers/index-text.js';
import { indexThread } from './_helpers/index-thread.js';

type IndexInBackground = (ctx: PluginContext, fn: () => Promise<void>) => void;

const indexInBackground: IndexInBackground = (ctx, fn) => {
  void (async () => {
    try {
      await fn();
    } catch (err) {
      ctx.logger.warn(`search: indexing failed: ${err}`);
    }
  })();
};

let backfillAbort: AbortController | null = null;

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

    // Fire-and-forget backfill on startup with cancellation support
    backfillAbort = new AbortController();
    const { signal } = backfillAbort;
    void (async () => {
      try {
        await backfill(qdrant, ctx.db, ctx.logger, signal);
      } catch (err) {
        if (!signal.aborted) {
          ctx.logger.warn(`search: backfill failed: ${err}`);
        }
      }
    })();
  },
  stop: async (ctx: PluginContext) => {
    if (backfillAbort) {
      backfillAbort.abort();
      backfillAbort = null;
      ctx.logger.info('search: backfill aborted on shutdown');
    }
  },
  register: async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Search indexing plugin registered');

    return {
      onMessage: async (threadId, _role, content) => {
        const qdrant = getQdrantClient();
        if (!qdrant) {
          return;
        }

        // Only index user messages — assistant messages are indexed via onPipelineComplete.
        // Use the content param directly instead of querying the DB to avoid race conditions
        // when concurrent pipelines arrive for the same thread.
        if (_role !== 'user') {
          return;
        }

        const pointId = crypto.randomUUID();
        indexInBackground(ctx, () =>
          indexText(qdrant, pointId, content, {
            threadId,
            role: 'user',
            createdAt: new Date().toISOString(),
          }),
        );
      },

      onPipelineComplete: async (threadId, result) => {
        const qdrant = getQdrantClient();
        if (!qdrant) {
          return;
        }

        // Index the assistant response directly from invokeResult.output.
        // onPipelineComplete fires BEFORE the assistant message is persisted to the DB,
        // so querying db.message would return the previous assistant message (wrong).
        const output = result.invokeResult?.output;
        if (output) {
          const pointId = crypto.randomUUID();
          indexInBackground(ctx, () =>
            indexText(qdrant, pointId, output, {
              threadId,
              role: 'assistant',
              createdAt: new Date().toISOString(),
            }),
          );
        }

        // Thread re-indexing is handled by onBroadcast('thread:name-updated')
        // to avoid racing with the auto-namer plugin.
      },

      onBroadcast: async (event, data) => {
        if (event !== 'thread:name-updated') {
          return;
        }

        const qdrant = getQdrantClient();
        if (!qdrant) {
          return;
        }

        const { threadId } = data as { threadId: string };
        if (!threadId) {
          return;
        }

        indexInBackground(ctx, () => indexThread(qdrant, ctx.db, threadId));
      },
    };
  },
};
