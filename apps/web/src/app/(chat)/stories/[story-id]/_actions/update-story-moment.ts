'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpdateStoryMomentInput = {
  momentId: string;
  annotation?: string | null;
  summary?: string;
  description?: string | null;
  storyTime?: string | null;
  kind?: string;
  importance?: number;
};

type UpdateStoryMomentResult = { success: true } | { error: string };

type UpdateStoryMoment = (input: UpdateStoryMomentInput) => Promise<UpdateStoryMomentResult>;

export const updateStoryMoment: UpdateStoryMoment = async (input) => {
  if (!input.momentId?.trim()) {
    return { error: 'Moment ID is required' };
  }

  const data: Record<string, unknown> = {};
  if (input.annotation !== undefined) {
    data.annotation = input.annotation;
  }
  if (input.summary !== undefined) {
    data.summary = input.summary;
  }
  if (input.description !== undefined) {
    data.description = input.description;
  }
  if (input.storyTime !== undefined) {
    data.storyTime = input.storyTime;
  }
  if (input.kind !== undefined) {
    data.kind = input.kind;
  }
  if (input.importance !== undefined) {
    data.importance = input.importance;
  }

  if (Object.keys(data).length === 0) {
    return { error: 'No fields to update' };
  }

  await prisma.storyMoment.update({
    where: { id: input.momentId },
    data,
  });

  revalidatePath('/stories');
  return { success: true };
};
