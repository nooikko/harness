'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type DeleteAgent = (agentId: string) => Promise<{ success: true } | { error: string }>;

export const deleteAgent: DeleteAgent = async (agentId) => {
  try {
    await prisma.agent.delete({ where: { id: agentId } });
    revalidatePath('/agents');
    return { success: true };
  } catch {
    return { error: 'Failed to delete agent' };
  }
};
