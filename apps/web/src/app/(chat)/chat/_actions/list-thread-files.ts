'use server';

import type { File as DbFile } from '@harness/database';
import { prisma } from '@harness/database';

const MAX_FILES = 100;

type ListThreadFiles = (threadId: string) => Promise<DbFile[]>;

export const listThreadFiles: ListThreadFiles = async (threadId) => {
  return prisma.file.findMany({
    where: { threadId },
    orderBy: { createdAt: 'desc' },
    take: MAX_FILES,
  });
};
