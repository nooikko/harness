'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';

type UpdateStoryInput = {
  id: string;
  name?: string;
  premise?: string;
  agentId?: string | null;
};

type UpdateStoryResult = { success: true } | { error: string };

type UpdateStory = (input: UpdateStoryInput) => Promise<UpdateStoryResult>;

export const updateStory: UpdateStory = async ({ id, ...fields }) => {
  const data: Record<string, unknown> = {};
  if (fields.name !== undefined) {
    data.name = fields.name;
  }
  if (fields.premise !== undefined) {
    data.premise = fields.premise;
  }
  if (fields.agentId !== undefined) {
    data.agentId = fields.agentId;
  }

  try {
    await prisma.story.update({ where: { id }, data });
    revalidatePath('/stories');
    return { success: true };
  } catch (err) {
    logServerError({ action: 'updateStory', error: err, context: { id } });
    return { error: 'Failed to update story' };
  }
};
