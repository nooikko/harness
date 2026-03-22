'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';

type DeleteStory = (storyId: string) => Promise<{ success: true } | { error: string }>;

export const deleteStory: DeleteStory = async (storyId) => {
  try {
    await prisma.story.delete({ where: { id: storyId } });
    revalidatePath('/stories');
    return { success: true };
  } catch (err) {
    logServerError({ action: 'deleteStory', error: err, context: { storyId } });
    return { error: 'Failed to delete story' };
  }
};
