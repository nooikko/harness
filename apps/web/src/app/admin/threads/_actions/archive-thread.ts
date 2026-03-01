'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type ArchiveThread = (id: string) => Promise<void>;

export const archiveThread: ArchiveThread = async (id) => {
  await prisma.thread.update({
    where: { id },
    data: { status: 'archived' },
  });
  revalidatePath('/admin/threads');
};
