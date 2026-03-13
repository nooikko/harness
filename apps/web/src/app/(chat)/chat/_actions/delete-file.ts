'use server';

import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { loadEnv } from '@/app/_helpers/env';
import { notifyOrchestrator } from '@/app/_helpers/notify-orchestrator';

type DeleteFileResult = { ok: true } | { error: string };
type DeleteFile = (fileId: string) => Promise<DeleteFileResult>;

export const deleteFile: DeleteFile = async (fileId) => {
  const env = loadEnv();

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) {
    return { error: 'File not found' };
  }

  // Disk delete FIRST — if this fails, DB record persists for retry
  const fullPath = join(env.UPLOAD_DIR, file.path);
  try {
    await unlink(fullPath);
  } catch (err) {
    // ENOENT is OK — idempotent delete
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code !== 'ENOENT') {
      return { error: `Disk delete failed: ${err.message}` };
    }
  }

  await prisma.file.delete({ where: { id: fileId } });

  revalidatePath('/');

  void notifyOrchestrator('file:deleted', {
    fileId: file.id,
    name: file.name,
    scope: file.scope,
    projectId: file.projectId,
    threadId: file.threadId,
    agentId: file.agentId,
  });

  return { ok: true };
};
