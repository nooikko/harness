'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type DeleteThread = (threadId: string) => Promise<void>;

export const deleteThread: DeleteThread = async (threadId) => {
  await prisma.thread.updateMany({
    where: { parentThreadId: threadId },
    data: { parentThreadId: null },
  });

  await prisma.thread.delete({
    where: { id: threadId },
  });

  revalidatePath('/');
};
