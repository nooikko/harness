'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';

type CreateStoryInput = {
  name: string;
  premise?: string;
  agentId?: string;
};

type CreateStoryResult = { storyId: string } | { error: string };

type CreateStory = (input: CreateStoryInput) => Promise<CreateStoryResult>;

export const createStory: CreateStory = async (input) => {
  if (!input.name?.trim()) {
    return { error: 'Name is required' };
  }

  try {
    const story = await prisma.story.create({
      data: {
        name: input.name.trim(),
        premise: input.premise ?? null,
        agentId: input.agentId ?? null,
      },
    });
    revalidatePath('/stories');
    return { storyId: story.id };
  } catch (err) {
    logServerError({ action: 'createStory', error: err, context: { name: input.name } });
    return { error: 'Failed to create story' };
  }
};
