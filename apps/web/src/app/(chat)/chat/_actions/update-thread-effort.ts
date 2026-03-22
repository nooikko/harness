'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpdateThreadEffort = (threadId: string, effort: string | null) => Promise<void>;

export const updateThreadEffort: UpdateThreadEffort = async (threadId, effort) => {
  await prisma.thread.update({
    where: { id: threadId },
    data: { effort },
  });

  revalidatePath('/');
};
