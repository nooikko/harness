import type { InvokeResult } from '@harness/plugin-contract';
import type { PrismaClient } from 'database';

type PersistPipelineComplete = (db: PrismaClient, threadId: string, invokeResult: InvokeResult) => Promise<void>;

const persistPipelineComplete: PersistPipelineComplete = async (db, threadId, invokeResult) => {
  await db.message.create({
    data: {
      threadId,
      role: 'system',
      kind: 'status',
      source: 'pipeline',
      content: 'Pipeline completed',
      metadata: {
        event: 'pipeline_complete',
        durationMs: invokeResult.durationMs,
        inputTokens: invokeResult.inputTokens ?? null,
        outputTokens: invokeResult.outputTokens ?? null,
      },
    },
  });
};

export { persistPipelineComplete };
