'use server';

import { prisma } from 'database';
import { revalidatePath } from 'next/cache';

type ToggleCronJob = (id: string) => Promise<void>;

export const toggleCronJob: ToggleCronJob = async (id) => {
  const job = await prisma.cronJob.findUniqueOrThrow({ where: { id } });
  await prisma.cronJob.update({
    where: { id },
    data: { enabled: !job.enabled },
  });
  revalidatePath('/admin/cron-jobs');
};
