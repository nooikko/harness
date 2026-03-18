'use server';

import { prisma } from '@harness/database';

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

type ActivePipelineResult = { active: true; startedAt: string; traceId: string } | { active: false; timedOut?: boolean };

type GetActivePipeline = (threadId: string) => Promise<ActivePipelineResult>;

export const getActivePipeline: GetActivePipeline = async (threadId) => {
  // Find the most recent pipeline_start for this thread
  const startMessage = await prisma.message.findFirst({
    where: {
      threadId,
      role: 'system',
      kind: 'status',
      content: 'Pipeline started',
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, metadata: true, createdAt: true },
  });

  if (!startMessage) {
    return { active: false };
  }

  const metadata = startMessage.metadata as Record<string, unknown> | null;
  const traceId = (metadata?.traceId as string) ?? '';
  const startedAt = (metadata?.startedAt as string) ?? startMessage.createdAt.toISOString();

  // Check if there's a matching pipeline_complete after this start
  const completeMessage = await prisma.message.findFirst({
    where: {
      threadId,
      role: 'system',
      kind: 'status',
      content: 'Pipeline completed',
      createdAt: { gte: startMessage.createdAt },
    },
    select: { id: true },
  });

  if (completeMessage) {
    return { active: false };
  }

  // No completion found — check if stale
  const elapsed = Date.now() - new Date(startedAt).getTime();
  if (elapsed > STALE_THRESHOLD_MS) {
    return { active: false, timedOut: true };
  }

  return { active: true, startedAt, traceId };
};
