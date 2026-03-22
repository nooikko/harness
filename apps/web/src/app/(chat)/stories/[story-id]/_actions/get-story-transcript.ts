'use server';

import { prisma } from '@harness/database';

type TranscriptMessage = {
  role: 'human' | 'assistant';
  content: string;
  index: number;
};

type AnnotationData = {
  id: string;
  messageIndex: number;
  content: string;
  kind: string;
  momentId: string | null;
  createdAt: string;
};

type TranscriptDetail = {
  id: string;
  label: string;
  sourceType: string;
  processed: boolean;
  processedThrough: number | null;
  totalChunks: number | null;
  messages: TranscriptMessage[];
  annotations: AnnotationData[];
} | null;

type GetStoryTranscript = (transcriptId: string, storyId: string) => Promise<TranscriptDetail>;

export const getStoryTranscript: GetStoryTranscript = async (transcriptId, storyId) => {
  const transcript = await prisma.storyTranscript.findFirst({
    where: { id: transcriptId, storyId },
    include: {
      annotations: {
        orderBy: { messageIndex: 'asc' },
      },
    },
  });

  if (!transcript) {
    return null;
  }

  // Parse the raw content into messages
  const messages: TranscriptMessage[] = [];
  const lines = transcript.rawContent.split('\n');
  let currentRole: 'human' | 'assistant' | null = null;
  let currentContent: string[] = [];
  let messageIndex = 0;

  const flush = () => {
    if (currentRole && currentContent.length > 0) {
      messages.push({
        role: currentRole,
        content: currentContent.join('\n').trim(),
        index: messageIndex++,
      });
      currentContent = [];
    }
  };

  for (const line of lines) {
    const humanMatch = /^(?:Human|H|User):\s*(.*)/i.exec(line);
    const assistantMatch = /^(?:Assistant|A):\s*(.*)/i.exec(line);

    if (humanMatch) {
      flush();
      currentRole = 'human';
      if (humanMatch[1]?.trim()) {
        currentContent.push(humanMatch[1]);
      }
    } else if (assistantMatch) {
      flush();
      currentRole = 'assistant';
      if (assistantMatch[1]?.trim()) {
        currentContent.push(assistantMatch[1]);
      }
    } else if (currentRole) {
      currentContent.push(line);
    }
  }
  flush();

  return {
    id: transcript.id,
    label: transcript.label,
    sourceType: transcript.sourceType,
    processed: transcript.processed,
    processedThrough: transcript.processedThrough,
    totalChunks: transcript.totalChunks,
    messages,
    annotations: transcript.annotations.map((a) => ({
      id: a.id,
      messageIndex: a.messageIndex,
      content: a.content,
      kind: a.kind,
      momentId: a.momentId,
      createdAt: a.createdAt.toISOString(),
    })),
  };
};
