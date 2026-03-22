'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';

type UpdateStoryCharacterInput = {
  id: string;
  personality?: string;
  appearance?: string;
  mannerisms?: string;
  motives?: string;
  backstory?: string;
  relationships?: string;
  color?: string;
  status?: string;
};

type UpdateStoryCharacterResult = { success: true } | { error: string };

type UpdateStoryCharacter = (input: UpdateStoryCharacterInput) => Promise<UpdateStoryCharacterResult>;

export const updateStoryCharacter: UpdateStoryCharacter = async ({ id, ...fields }) => {
  const data: Record<string, unknown> = {};
  if (fields.personality !== undefined) {
    data.personality = fields.personality;
  }
  if (fields.appearance !== undefined) {
    data.appearance = fields.appearance;
  }
  if (fields.mannerisms !== undefined) {
    data.mannerisms = fields.mannerisms;
  }
  if (fields.motives !== undefined) {
    data.motives = fields.motives;
  }
  if (fields.backstory !== undefined) {
    data.backstory = fields.backstory;
  }
  if (fields.relationships !== undefined) {
    data.relationships = fields.relationships;
  }
  if (fields.color !== undefined) {
    data.color = fields.color;
  }
  if (fields.status !== undefined) {
    data.status = fields.status;
  }

  try {
    await prisma.storyCharacter.update({ where: { id }, data });
    revalidatePath('/stories');
    return { success: true };
  } catch (err) {
    logServerError({ action: 'updateStoryCharacter', error: err, context: { id } });
    return { error: 'Failed to update character' };
  }
};
