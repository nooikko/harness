import type { PrismaClient } from '@harness/database';
import type { QdrantClient } from '@harness/vector-search';
import { indexMessage } from './index-message.js';
import { indexThread } from './index-thread.js';

type Logger = { info: (msg: string) => void; warn: (msg: string) => void };

export type Backfill = (qdrant: QdrantClient, db: PrismaClient, logger: Logger) => Promise<void>;

const BATCH_SIZE = 100;

/**
 * Backfills existing messages and threads into Qdrant.
 * Runs on plugin start if the Qdrant collections are empty.
 * Processes in batches to avoid memory pressure.
 */
export const backfill: Backfill = async (qdrant, db, logger) => {
  // Check if collections already have data (skip if so)
  const { points_count } = await qdrant.getCollection('messages');
  if (points_count && points_count > 0) {
    logger.info('search: Qdrant collections already populated, skipping backfill');
    return;
  }

  logger.info('search: Starting backfill of existing content into Qdrant');

  // Backfill messages
  let messageOffset = 0;
  let messagesIndexed = 0;
  while (true) {
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
      try {
        await indexMessage(qdrant, db, msg.id);
        messagesIndexed++;
      } catch {
        // Skip individual message failures during backfill
      }
    }

    messageOffset += messages.length;
  }

  // Backfill threads
  let threadOffset = 0;
  let threadsIndexed = 0;
  while (true) {
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
      try {
        await indexThread(qdrant, db, thread.id);
        threadsIndexed++;
      } catch {
        // Skip individual thread failures during backfill
      }
    }

    threadOffset += threads.length;
  }

  logger.info(`search: Backfill complete — ${messagesIndexed} messages, ${threadsIndexed} threads indexed`);
};
