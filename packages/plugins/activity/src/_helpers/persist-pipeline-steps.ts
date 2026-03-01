import type { PrismaClient } from '@harness/database';
import type { PipelineStep } from '@harness/plugin-contract';

type PersistPipelineSteps = (db: PrismaClient, threadId: string, steps: PipelineStep[]) => Promise<void>;

const persistPipelineSteps: PersistPipelineSteps = async (db, threadId, steps) => {
  for (const step of steps) {
    await db.message.create({
      data: {
        threadId,
        role: 'system',
        kind: 'pipeline_step',
        source: 'pipeline',
        content: step.step,
        metadata: { step: step.step, detail: step.detail ?? null, ...(step.metadata ?? {}) },
      },
    });
  }
};

export { persistPipelineSteps };
