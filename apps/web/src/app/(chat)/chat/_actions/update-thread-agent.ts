'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpdateThreadAgent = (threadId: string, agentId: string | null) => Promise<void>;

export const updateThreadAgent: UpdateThreadAgent = async (threadId, agentId) => {
  await prisma.thread.update({
    where: { id: threadId },
    data: { agentId, sessionId: null },
  });

  revalidatePath('/');
};
