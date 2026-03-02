'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type DeleteAgentMemory = (memoryId: string, agentId: string) => Promise<{ success: true } | { error: string }>;

export const deleteAgentMemory: DeleteAgentMemory = async (memoryId, agentId) => {
  try {
    await prisma.agentMemory.delete({ where: { id: memoryId } });
    revalidatePath(`/agents/${agentId}`);
    return { success: true };
  } catch {
    return { error: 'Failed to delete memory' };
  }
};
