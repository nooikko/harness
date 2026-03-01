// Loads recent conversation history from a Thread via Prisma

import type { PrismaClient } from '@harness/database';

export type HistoryMessage = {
  role: string;
  content: string;
  createdAt: Date;
};

export type HistoryResult = {
  messages: HistoryMessage[];
  threadId: string;
};

type LoadHistory = (db: PrismaClient, threadId: string, limit?: number) => Promise<HistoryResult>;

const DEFAULT_HISTORY_LIMIT = 50;

export const loadHistory: LoadHistory = async (db, threadId, limit) => {
  const effectiveLimit = limit ?? DEFAULT_HISTORY_LIMIT;

  const messages = await db.message.findMany({
    where: { threadId },
    orderBy: { createdAt: 'desc' },
    take: effectiveLimit,
    select: {
      role: true,
      content: true,
      createdAt: true,
    },
  });

  // Reverse so messages are in chronological order (oldest first)
  const chronological = messages.reverse();

  return { messages: chronological, threadId };
};
