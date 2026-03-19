'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';
import { notifyCronReload } from './_helpers/notify-cron-reload';

type DeleteCronJob = (id: string) => Promise<{ success: true } | { error: string }>;

export const deleteCronJob: DeleteCronJob = async (id) => {
  try {
    await prisma.cronJob.delete({ where: { id } });
    revalidatePath('/admin/cron-jobs');
    void notifyCronReload();
    return { success: true };
  } catch (err) {
    logServerError({ action: 'deleteCronJob', error: err, context: { id } });
    return { error: 'Failed to delete cron job' };
  }
};
