'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpdateThreadPermissionMode = (threadId: string, permissionMode: string | null) => Promise<void>;

export const updateThreadPermissionMode: UpdateThreadPermissionMode = async (threadId, permissionMode) => {
  await prisma.thread.update({
    where: { id: threadId },
    data: { permissionMode },
  });

  revalidatePath('/');
};
