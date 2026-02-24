'use server';

import { prisma } from 'database';
import { revalidatePath } from 'next/cache';

type CreateThreadResult = { threadId: string };

type CreateThread = () => Promise<CreateThreadResult>;

export const createThread: CreateThread = async () => {
  const thread = await prisma.thread.create({
    data: {
      source: 'web',
      sourceId: crypto.randomUUID(),
      kind: 'general',
      status: 'open',
    },
  });

  revalidatePath('/');

  return { threadId: thread.id };
};
