'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpdateThreadProject = (threadId: string, projectId: string | null) => Promise<void>;

export const updateThreadProject: UpdateThreadProject = async (threadId, projectId) => {
  await prisma.thread.update({
    where: { id: threadId },
    data: { projectId },
  });

  revalidatePath('/');
};
