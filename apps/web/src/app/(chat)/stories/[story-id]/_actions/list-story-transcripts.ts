'use server';

import { prisma } from '@harness/database';

type TranscriptSummary = {
  id: string;
  label: string;
  sourceType: string;
  processed: boolean;
  processedThrough: number | null;
  totalChunks: number | null;
  messageCount: number | null;
  annotationCount: number;
  momentCount: number;
  createdAt: string;
};

type ListStoryTranscripts = (storyId: string) => Promise<TranscriptSummary[]>;

export const listStoryTranscripts: ListStoryTranscripts = async (storyId) => {
  const transcripts = await prisma.storyTranscript.findMany({
    where: { storyId },
    include: {
      _count: { select: { annotations: true, moments: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return transcripts.map((t) => ({
    id: t.id,
    label: t.label,
    sourceType: t.sourceType,
    processed: t.processed,
    processedThrough: t.processedThrough,
    totalChunks: t.totalChunks,
    messageCount: t.messageCount,
    annotationCount: t._count.annotations,
    momentCount: t._count.moments,
    createdAt: t.createdAt.toISOString(),
  }));
};
