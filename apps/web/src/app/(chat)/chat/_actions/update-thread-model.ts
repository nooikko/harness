'use server';

import { prisma } from 'database';
import { revalidatePath } from 'next/cache';

type UpdateThreadModel = (threadId: string, model: string | null) => Promise<void>;

export const updateThreadModel: UpdateThreadModel = async (threadId, model) => {
  await prisma.thread.update({
    where: { id: threadId },
    data: { model, sessionId: null },
  });

  revalidatePath('/');
};
