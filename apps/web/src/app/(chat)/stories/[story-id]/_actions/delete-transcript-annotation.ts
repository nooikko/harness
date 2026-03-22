'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type DeleteTranscriptAnnotation = (annotationId: string) => Promise<{ success: true } | { error: string }>;

export const deleteTranscriptAnnotation: DeleteTranscriptAnnotation = async (annotationId) => {
  if (!annotationId?.trim()) {
    return { error: 'Annotation ID is required' };
  }

  await prisma.transcriptAnnotation.delete({
    where: { id: annotationId },
  });

  revalidatePath('/stories');
  return { success: true };
};
