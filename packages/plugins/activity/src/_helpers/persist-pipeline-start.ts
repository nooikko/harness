import type { PrismaClient } from '@harness/database';

type PersistPipelineStart = (db: PrismaClient, threadId: string, traceId: string) => Promise<void>;

const persistPipelineStart: PersistPipelineStart = async (db, threadId, traceId) => {
  await db.message.create({
    data: {
      threadId,
      role: 'system',
      kind: 'status',
      source: 'pipeline',
      content: 'Pipeline started',
      metadata: { event: 'pipeline_start', traceId, startedAt: new Date().toISOString() },
    },
  });
};

export { persistPipelineStart };
