'use server';

import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { loadEnv } from '@/app/_helpers/env';
import { logServerError } from '@/lib/log-server-error';

type DeleteProject = (projectId: string) => Promise<void>;

export const deleteProject: DeleteProject = async (projectId) => {
  const env = loadEnv();

  // Clean up disk files before cascade deletes DB records
  const files = await prisma.file.findMany({
    where: { projectId },
    select: { path: true },
  });
  for (const file of files) {
    try {
      await unlink(join(env.UPLOAD_DIR, file.path));
    } catch {
      // Best-effort cleanup — ENOENT and other errors are silently ignored
    }
  }

  try {
    await prisma.$transaction([
      prisma.thread.updateMany({
        where: { projectId },
        data: { projectId: null },
      }),
      prisma.project.delete({
        where: { id: projectId },
      }),
    ]);

    revalidatePath('/chat');
  } catch (error) {
    logServerError({ action: 'deleteProject', error, context: { projectId } });
    throw new Error(`Failed to delete project: ${error instanceof Error ? error.message : String(error)}`);
  }
};
