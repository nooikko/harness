'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type SetThreadProject = (threadId: string, projectId: string | null) => Promise<void>;

export const setThreadProject: SetThreadProject = async (threadId, projectId) => {
  try {
    await prisma.thread.update({
      where: { id: threadId },
      data: { projectId },
    });

    revalidatePath('/chat');
  } catch (error) {
    throw new Error(`Failed to set thread project: ${error instanceof Error ? error.message : String(error)}`);
  }
};
