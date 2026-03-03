'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { notifyCronReload } from './_helpers/notify-cron-reload';

type UpdateCronJobInput = {
  id: string;
  name?: string;
  agentId?: string;
  threadId?: string | null;
  projectId?: string | null;
  schedule?: string | null;
  fireAt?: string | null;
  prompt?: string;
  enabled?: boolean;
};

type UpdateCronJobResult = { success: true } | { error: string };

type UpdateCronJob = (input: UpdateCronJobInput) => Promise<UpdateCronJobResult>;

export const updateCronJob: UpdateCronJob = async (input) => {
  const { id, ...fields } = input;

  if ('schedule' in fields && 'fireAt' in fields) {
    const hasSchedule = !!fields.schedule;
    const hasFireAt = !!fields.fireAt;
    if (hasSchedule === hasFireAt) {
      return {
        error: 'Exactly one of schedule or fireAt must be set, not both',
      };
    }
  }

  if (fields.name !== undefined && !fields.name.trim()) {
    return { error: 'Name is required' };
  }

  if (fields.prompt !== undefined && !fields.prompt.trim()) {
    return { error: 'Prompt is required' };
  }

  const data: Record<string, unknown> = {};

  if (fields.name !== undefined) {
    data.name = fields.name.trim();
  }
  if (fields.agentId !== undefined) {
    data.agentId = fields.agentId;
  }
  if ('threadId' in fields) {
    data.threadId = fields.threadId ?? null;
  }
  if ('projectId' in fields) {
    data.projectId = fields.projectId ?? null;
  }
  if ('schedule' in fields) {
    data.schedule = fields.schedule ?? null;
  }
  if ('fireAt' in fields) {
    data.fireAt = fields.fireAt ? new Date(fields.fireAt) : null;
  }
  if (fields.prompt !== undefined) {
    data.prompt = fields.prompt;
  }
  if (fields.enabled !== undefined) {
    data.enabled = fields.enabled;
  }

  try {
    await prisma.cronJob.update({
      where: { id },
      data,
    });
    revalidatePath('/admin/cron-jobs');
    void notifyCronReload();
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return { error: `A cron job named "${fields.name}" already exists` };
    }
    return { error: 'Failed to update cron job' };
  }
};
