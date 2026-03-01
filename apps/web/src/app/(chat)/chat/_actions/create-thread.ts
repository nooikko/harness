'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type CreateThreadOptions = {
  model?: string;
};

type CreateThreadResult = { threadId: string };

type CreateThread = (options?: CreateThreadOptions) => Promise<CreateThreadResult>;

export const createThread: CreateThread = async (options) => {
  const thread = await prisma.thread.create({
    data: {
      source: 'web',
      sourceId: crypto.randomUUID(),
      kind: 'general',
      status: 'open',
      model: options?.model,
    },
  });

  revalidatePath('/');

  return { threadId: thread.id };
};
