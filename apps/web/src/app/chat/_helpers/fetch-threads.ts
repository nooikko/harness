import type { Thread } from 'database';
import { prisma } from 'database';

type FetchThreads = () => Promise<Thread[]>;

/**
 * Fetches all non-archived threads from the database, ordered by lastActivity.
 */
export const fetchThreads: FetchThreads = async () => {
  return prisma.thread.findMany({
    where: {
      status: { not: 'archived' },
    },
    orderBy: { lastActivity: 'desc' },
  });
};
