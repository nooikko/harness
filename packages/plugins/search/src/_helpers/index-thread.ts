import type { PrismaClient } from '@harness/database';
import type { QdrantClient } from '@harness/vector-search';
import { COLLECTION_NAMES, upsertPoint } from '@harness/vector-search';

export type IndexThread = (qdrant: QdrantClient, db: PrismaClient, threadId: string) => Promise<void>;

/**
 * Indexes a thread into Qdrant for semantic search.
 * Uses the thread name as the searchable text.
 */
export const indexThread: IndexThread = async (qdrant, db, threadId) => {
  const thread = await db.thread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      name: true,
      status: true,
      agentId: true,
      projectId: true,
      kind: true,
      createdAt: true,
    },
  });

  if (!thread) {
    return;
  }
  if (!thread.name || thread.name.trim().length === 0) {
    return;
  }

  await upsertPoint(qdrant, COLLECTION_NAMES.threads, thread.id, thread.name, {
    status: thread.status,
    agentId: thread.agentId,
    projectId: thread.projectId,
    kind: thread.kind,
    createdAt: thread.createdAt.toISOString(),
  });
};
