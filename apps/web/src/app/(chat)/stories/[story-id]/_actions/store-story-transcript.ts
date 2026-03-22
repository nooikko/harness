'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';

type StoreStoryTranscriptInput = {
  storyId: string;
  label: string;
  rawContent: string;
  sourceType?: string;
  sortOrder?: number;
};

type StoreStoryTranscriptResult = { transcriptId: string } | { error: string };

type StoreStoryTranscript = (input: StoreStoryTranscriptInput) => Promise<StoreStoryTranscriptResult>;

export const storeStoryTranscript: StoreStoryTranscript = async (input) => {
  if (!input.storyId?.trim()) {
    return { error: 'Story ID is required' };
  }
  if (!input.label?.trim()) {
    return { error: 'Label is required' };
  }
  if (!input.rawContent?.trim()) {
    return { error: 'Transcript content is required' };
  }

  try {
    const sortOrder = input.sortOrder ?? (await prisma.storyTranscript.count({ where: { storyId: input.storyId } }));

    const transcript = await prisma.storyTranscript.create({
      data: {
        storyId: input.storyId,
        label: input.label.trim(),
        sourceType: input.sourceType ?? 'claude',
        rawContent: input.rawContent,
        sortOrder,
      },
    });

    revalidatePath(`/stories/${input.storyId}/workspace`);
    return { transcriptId: transcript.id };
  } catch (err) {
    logServerError({ action: 'storeStoryTranscript', error: err, context: { storyId: input.storyId } });
    return { error: 'Failed to store transcript' };
  }
};
