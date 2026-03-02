'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type CreateAgentInput = {
  slug: string;
  name: string;
  soul: string;
  identity: string;
  role?: string;
  goal?: string;
  backstory?: string;
};

type CreateAgentResult = { agentId: string } | { error: string };

type CreateAgent = (input: CreateAgentInput) => Promise<CreateAgentResult>;

export const createAgent: CreateAgent = async (input) => {
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    return { error: 'Slug must be lowercase letters, numbers, and hyphens only' };
  }

  try {
    const agent = await prisma.agent.create({
      data: {
        slug: input.slug,
        name: input.name,
        soul: input.soul,
        identity: input.identity,
        role: input.role ?? null,
        goal: input.goal ?? null,
        backstory: input.backstory ?? null,
      },
    });
    revalidatePath('/agents');
    return { agentId: agent.id };
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return { error: `Slug "${input.slug}" is already taken` };
    }
    return { error: 'Failed to create agent' };
  }
};
