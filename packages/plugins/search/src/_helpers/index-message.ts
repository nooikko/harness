import type { PrismaClient } from '@harness/database';
import type { QdrantClient } from '@harness/vector-search';
import { COLLECTION_NAMES, upsertPoint } from '@harness/vector-search';

export type IndexMessage = (qdrant: QdrantClient, db: PrismaClient, messageId: string) => Promise<void>;

/**
 * Indexes a single message into Qdrant for semantic search.
 * Only indexes 'text' kind messages with non-empty content.
 */
export const indexMessage: IndexMessage = async (qdrant, db, messageId) => {
  const message = await db.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      content: true,
      role: true,
      kind: true,
      threadId: true,
      createdAt: true,
    },
  });

  if (!message) {
    return;
  }
  if (message.kind !== 'text') {
    return;
  }
  if (!message.content || message.content.trim().length === 0) {
    return;
  }

  // Truncate to first 512 chars for embedding — keeps vector focused on core content
  const text = message.content.slice(0, 512);

  await upsertPoint(qdrant, COLLECTION_NAMES.messages, message.id, text, {
    threadId: message.threadId,
    role: message.role,
    createdAt: message.createdAt.toISOString(),
  });
};
