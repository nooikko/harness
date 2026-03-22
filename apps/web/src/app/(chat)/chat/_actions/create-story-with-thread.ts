'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';

type CreateStoryWithThreadInput = {
  name: string;
  premise?: string;
  agentId?: string;
};

type CreateStoryWithThreadResult = { storyId: string; threadId: string } | { error: string };

type CreateStoryWithThread = (input: CreateStoryWithThreadInput) => Promise<CreateStoryWithThreadResult>;

export const createStoryWithThread: CreateStoryWithThread = async (input) => {
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

    const thread = await prisma.thread.create({
      data: {
        source: 'web',
        sourceId: crypto.randomUUID(),
        kind: 'storytelling',
        status: 'active',
        name: story.name,
        storyId: story.id,
        agentId: input.agentId ?? null,
      },
    });

    revalidatePath('/');
    return { storyId: story.id, threadId: thread.id };
  } catch (err) {
    logServerError({ action: 'createStoryWithThread', error: err, context: { name: input.name } });
    return { error: 'Failed to create story' };
  }
};
