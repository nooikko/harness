'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpdateThreadInstructions = (threadId: string, customInstructions: string) => Promise<void>;

export const updateThreadInstructions: UpdateThreadInstructions = async (threadId, customInstructions) => {
  await prisma.thread.update({
    where: { id: threadId },
    data: { customInstructions },
  });

  revalidatePath('/');
};
