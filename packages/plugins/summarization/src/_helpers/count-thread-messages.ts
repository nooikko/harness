// Counts text messages in a thread (excluding activity rows)

import type { PrismaClient } from '@harness/database';

type CountThreadMessages = (db: PrismaClient, threadId: string) => Promise<number>;

export const countThreadMessages: CountThreadMessages = async (db, threadId) => db.message.count({ where: { threadId, kind: 'text' } });
