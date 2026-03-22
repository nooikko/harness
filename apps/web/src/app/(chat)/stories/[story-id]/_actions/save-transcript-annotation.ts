'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type SaveAnnotationInput = {
  transcriptId: string;
  messageIndex: number;
  content: string;
  kind?: string;
  momentId?: string;
};

type SaveAnnotationResult = { id: string } | { error: string };

type SaveTranscriptAnnotation = (input: SaveAnnotationInput) => Promise<SaveAnnotationResult>;

export const saveTranscriptAnnotation: SaveTranscriptAnnotation = async (input) => {
  if (!input.transcriptId?.trim()) {
    return { error: 'Transcript ID is required' };
  }
  if (!input.content?.trim()) {
    return { error: 'Annotation content is required' };
  }

  const annotation = await prisma.transcriptAnnotation.create({
    data: {
      transcriptId: input.transcriptId,
      messageIndex: input.messageIndex,
      content: input.content.trim(),
      kind: input.kind ?? 'note',
      ...(input.momentId ? { momentId: input.momentId } : {}),
    },
  });

  revalidatePath('/stories');
  return { id: annotation.id };
};
