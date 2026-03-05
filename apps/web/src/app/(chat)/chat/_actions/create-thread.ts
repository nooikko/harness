'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

const DEFAULT_AGENT_SLUG = 'default';

type CreateThreadOptions = {
  model?: string;
  agentId?: string;
  projectId?: string;
};

type CreateThreadResult = { threadId: string };

type CreateThread = (options?: CreateThreadOptions) => Promise<CreateThreadResult>;

export const createThread: CreateThread = async (options) => {
  // Auto-assign default agent if no agentId specified
  let agentId = options?.agentId ?? null;
  if (!agentId) {
    const defaultAgent = await prisma.agent.findUnique({
      where: { slug: DEFAULT_AGENT_SLUG },
      select: { id: true },
    });
    if (defaultAgent) {
      agentId = defaultAgent.id;
    }
  }

  const thread = await prisma.thread.create({
    data: {
      source: 'web',
      sourceId: crypto.randomUUID(),
      kind: 'general',
      status: 'active',
      model: options?.model,
      agentId,
      projectId: options?.projectId,
    },
  });

  revalidatePath('/');

  return { threadId: thread.id };
};
