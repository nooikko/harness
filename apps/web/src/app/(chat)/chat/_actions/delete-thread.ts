'use server';

import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { loadEnv } from '@/app/_helpers/env';

type DeleteThread = (threadId: string) => Promise<void>;

export const deleteThread: DeleteThread = async (threadId) => {
  const env = loadEnv();

  // Clean up disk files before cascade deletes DB records
  const files = await prisma.file.findMany({
    where: { threadId },
    select: { path: true },
  });
  for (const file of files) {
    try {
      await unlink(join(env.UPLOAD_DIR, file.path));
    } catch {
      // Best-effort cleanup — ENOENT and other errors are silently ignored
    }
  }

  await prisma.thread.updateMany({
    where: { parentThreadId: threadId },
    data: { parentThreadId: null },
  });

  await prisma.thread.delete({
    where: { id: threadId },
  });

  revalidatePath('/');
};
