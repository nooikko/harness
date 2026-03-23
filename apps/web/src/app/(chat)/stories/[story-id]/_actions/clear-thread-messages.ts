'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';

type ClearThreadMessagesInput = {
  threadId: string;
  storyId: string;
};

type ClearThreadMessagesResult = { success: true; deleted: number } | { error: string };

type ClearThreadMessages = (input: ClearThreadMessagesInput) => Promise<ClearThreadMessagesResult>;

export const clearThreadMessages: ClearThreadMessages = async (input) => {
  if (!input.threadId?.trim()) {
    return { error: 'Thread ID is required' };
  }
  if (!input.storyId?.trim()) {
    return { error: 'Story ID is required' };
  }

  try {
    const result = await prisma.message.deleteMany({
      where: { threadId: input.threadId },
    });

    // Also clear the session so Claude starts fresh
    await prisma.thread.update({
      where: { id: input.threadId },
      data: { sessionId: null },
    });

    revalidatePath(`/stories/${input.storyId}/workspace`);
    return { success: true, deleted: result.count };
  } catch (err) {
    logServerError({ action: 'clearThreadMessages', error: err, context: { threadId: input.threadId } });
    return { error: 'Failed to clear messages' };
  }
};
