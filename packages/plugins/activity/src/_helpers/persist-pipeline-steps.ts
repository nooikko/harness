import type { PrismaClient } from '@harness/database';
import type { PipelineStep } from '@harness/plugin-contract';

type PersistPipelineSteps = (db: PrismaClient, threadId: string, steps: PipelineStep[], traceId?: string) => Promise<void>;

const persistPipelineSteps: PersistPipelineSteps = async (db, threadId, steps, traceId) => {
  for (const step of steps) {
    // durationMs is computed by the orchestrator and included in step.metadata
    const durationMs = (step.metadata?.durationMs as number | undefined) ?? null;

    await db.message.create({
      data: {
        threadId,
        role: 'system',
        kind: 'pipeline_step',
        source: 'pipeline',
        content: step.step,
        metadata: { step: step.step, detail: step.detail ?? null, durationMs, ...(step.metadata ?? {}), ...(traceId ? { traceId } : {}) },
      },
    });
  }
};

export { persistPipelineSteps };
