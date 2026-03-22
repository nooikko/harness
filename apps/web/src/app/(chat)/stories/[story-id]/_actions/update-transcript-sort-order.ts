'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';

type UpdateTranscriptSortOrderInput = {
  transcriptId: string;
  storyId: string;
  sortOrder: number;
};

type UpdateTranscriptSortOrderResult = { success: true } | { error: string };

type UpdateTranscriptSortOrder = (input: UpdateTranscriptSortOrderInput) => Promise<UpdateTranscriptSortOrderResult>;

export const updateTranscriptSortOrder: UpdateTranscriptSortOrder = async (input) => {
  if (!input.transcriptId?.trim()) {
    return { error: 'Transcript ID is required' };
  }
  if (!input.storyId?.trim()) {
    return { error: 'Story ID is required' };
  }
  if (typeof input.sortOrder !== 'number' || input.sortOrder < 0) {
    return { error: 'Sort order must be a non-negative number' };
  }

  try {
    await prisma.storyTranscript.update({
      where: { id: input.transcriptId },
      data: { sortOrder: input.sortOrder },
    });

    revalidatePath(`/stories/${input.storyId}/workspace`);
    return { success: true };
  } catch (err) {
    logServerError({
      action: 'updateTranscriptSortOrder',
      error: err,
      context: { transcriptId: input.transcriptId },
    });
    return { error: 'Failed to update sort order' };
  }
};
