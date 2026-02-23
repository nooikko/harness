import type { Message } from 'database';
import { prisma } from 'database';

type FetchMessages = (threadId: string) => Promise<Message[]>;

/**
 * Fetches all messages for a given thread, ordered by createdAt ascending.
 */
export const fetchMessages: FetchMessages = async (threadId) => {
  return prisma.message.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
  });
};
