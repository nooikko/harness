'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type DeleteCronJob = (id: string) => Promise<{ success: true } | { error: string }>;

export const deleteCronJob: DeleteCronJob = async (id) => {
  try {
    await prisma.cronJob.delete({ where: { id } });
    revalidatePath('/admin/cron-jobs');
    return { success: true };
  } catch {
    return { error: 'Failed to delete cron job' };
  }
};
