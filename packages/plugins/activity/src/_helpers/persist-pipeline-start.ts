import type { PrismaClient } from 'database';

type PersistPipelineStart = (db: PrismaClient, threadId: string) => Promise<void>;

const persistPipelineStart: PersistPipelineStart = async (db, threadId) => {
  await db.message.create({
    data: {
      threadId,
      role: 'system',
      kind: 'status',
      source: 'pipeline',
      content: 'Pipeline started',
      metadata: { event: 'pipeline_start' },
    },
  });
};

export { persistPipelineStart };
