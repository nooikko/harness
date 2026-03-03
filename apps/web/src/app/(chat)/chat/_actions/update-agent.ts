'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpdateAgentInput = {
  id: string;
  name?: string;
  soul?: string;
  identity?: string;
  userContext?: string | null;
  role?: string | null;
  goal?: string | null;
  backstory?: string | null;
  enabled?: boolean;
};

type UpdateAgentResult = { success: true } | { error: string };

type UpdateAgent = (input: UpdateAgentInput) => Promise<UpdateAgentResult>;

export const updateAgent: UpdateAgent = async ({ id, ...data }) => {
  try {
    await prisma.agent.update({
      where: { id },
      data: {
        ...data,
        ...(data.soul !== undefined ? { version: { increment: 1 } } : {}),
      },
    });
    revalidatePath('/agents');
    return { success: true };
  } catch {
    return { error: 'Failed to update agent' };
  }
};
