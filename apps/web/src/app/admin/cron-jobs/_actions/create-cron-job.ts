'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type CreateCronJobInput = {
  name: string;
  agentId: string;
  threadId?: string;
  projectId?: string;
  schedule?: string;
  fireAt?: string;
  prompt: string;
  enabled?: boolean;
};

type CreateCronJobResult = { success: true; id: string } | { error: string };

type CreateCronJob = (input: CreateCronJobInput) => Promise<CreateCronJobResult>;

export const createCronJob: CreateCronJob = async (input) => {
  const hasSchedule = !!input.schedule;
  const hasFireAt = !!input.fireAt;

  if (hasSchedule === hasFireAt) {
    return {
      error: 'Exactly one of schedule or fireAt must be set, not both',
    };
  }

  if (!input.name.trim()) {
    return { error: 'Name is required' };
  }

  if (!input.prompt.trim()) {
    return { error: 'Prompt is required' };
  }

  try {
    const job = await prisma.cronJob.create({
      data: {
        name: input.name.trim(),
        agentId: input.agentId,
        threadId: input.threadId ?? null,
        projectId: input.projectId ?? null,
        schedule: input.schedule ?? null,
        fireAt: input.fireAt ? new Date(input.fireAt) : null,
        prompt: input.prompt,
        enabled: input.enabled ?? true,
      },
    });
    revalidatePath('/admin/cron-jobs');
    return { success: true, id: job.id };
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return { error: `A cron job named "${input.name}" already exists` };
    }
    return { error: 'Failed to create cron job' };
  }
};
