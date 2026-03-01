'use server';

import { prisma } from '@harness/database';

type CheckForResponse = (threadId: string, afterDate: Date) => Promise<boolean>;

export const checkForResponse: CheckForResponse = async (threadId, afterDate) => {
  const message = await prisma.message.findFirst({
    where: {
      threadId,
      role: 'assistant',
      createdAt: { gt: afterDate },
    },
    select: { id: true },
  });

  return message !== null;
};
