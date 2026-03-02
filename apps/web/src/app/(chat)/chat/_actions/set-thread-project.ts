'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type SetThreadProject = (threadId: string, projectId: string | null) => Promise<void>;

export const setThreadProject: SetThreadProject = async (threadId, projectId) => {
  await prisma.thread.update({
    where: { id: threadId },
    data: { projectId },
  });

  revalidatePath('/chat');
};
