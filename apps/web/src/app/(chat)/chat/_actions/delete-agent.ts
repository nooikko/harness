'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';

type DeleteAgent = (agentId: string) => Promise<{ success: true } | { error: string }>;

export const deleteAgent: DeleteAgent = async (agentId) => {
  try {
    await prisma.agent.delete({ where: { id: agentId } });
    revalidatePath('/agents');
    return { success: true };
  } catch (err) {
    logServerError({ action: 'deleteAgent', error: err, context: { agentId } });
    return { error: 'Failed to delete agent' };
  }
};
