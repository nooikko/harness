import type { PrismaClient } from '@harness/database';
import type { QdrantClient } from '@harness/vector-search';
import { indexMessage } from './index-message.js';
import { indexThread } from './index-thread.js';

type Logger = { info: (msg: string) => void; warn: (msg: string) => void };

export type Backfill = (qdrant: QdrantClient, db: PrismaClient, logger: Logger, signal?: AbortSignal) => Promise<void>;

const BATCH_SIZE = 100;

/**
 * Backfills existing messages and threads into Qdrant.
 * Runs on plugin start if the Qdrant collections are empty.
 * Processes in batches to avoid memory pressure.
 * Checks each collection independently so a partial backfill resumes correctly.
 */
export const backfill: Backfill = async (qdrant, db, logger, signal) => {
  // Check each collection independently — a previous backfill may have completed
  // messages but crashed before threads (or vice versa).
  const [messagesInfo, threadsInfo] = await Promise.all([qdrant.getCollection('messages'), qdrant.getCollection('threads')]);

  const skipMessages = (messagesInfo.points_count ?? 0) > 0;
  const skipThreads = (threadsInfo.points_count ?? 0) > 0;

  if (skipMessages && skipThreads) {
    logger.info('search: Qdrant collections already populated, skipping backfill');
    return;
  }

  logger.info('search: Starting backfill of existing content into Qdrant');

  // Backfill messages
  let messagesIndexed = 0;
  if (!skipMessages) {
    let messageOffset = 0;
    while (!signal?.aborted) {
      const messages = await db.message.findMany({
        where: { kind: 'text' },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        skip: messageOffset,
        take: BATCH_SIZE,
      });

      if (messages.length === 0) {
        break;
      }

      for (const msg of messages) {
        if (signal?.aborted) {
          break;
        }
        try {
          await indexMessage(qdrant, db, msg.id);
          messagesIndexed++;
        } catch (err) {
          logger.warn(`search: failed to index message ${msg.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      messageOffset += messages.length;
    }
  }

  // Backfill threads
  let threadsIndexed = 0;
  if (!skipThreads) {
    let threadOffset = 0;
    while (!signal?.aborted) {
      const threads = await db.thread.findMany({
        where: { status: 'active' },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        skip: threadOffset,
        take: BATCH_SIZE,
      });

      if (threads.length === 0) {
        break;
      }

      for (const thread of threads) {
        if (signal?.aborted) {
          break;
        }
        try {
          await indexThread(qdrant, db, thread.id);
          threadsIndexed++;
        } catch (err) {
          logger.warn(`search: failed to index thread ${thread.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      threadOffset += threads.length;
    }
  }

  if (signal?.aborted) {
    logger.info(`search: Backfill aborted — ${messagesIndexed} messages, ${threadsIndexed} threads indexed before abort`);
  } else {
    logger.info(`search: Backfill complete — ${messagesIndexed} messages, ${threadsIndexed} threads indexed`);
  }
};
