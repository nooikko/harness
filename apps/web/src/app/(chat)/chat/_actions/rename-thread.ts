'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type RenameThread = (threadId: string, name: string) => Promise<void>;

export const renameThread: RenameThread = async (threadId, name) => {
  const trimmed = name.trim();

  if (!trimmed) {
    return;
  }

  await prisma.thread.update({
    where: { id: threadId },
    data: { name: trimmed },
  });

  revalidatePath('/');
};
