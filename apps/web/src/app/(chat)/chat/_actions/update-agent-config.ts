'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpdateAgentConfigInput = {
  agentId: string;
  memoryEnabled: boolean;
  reflectionEnabled: boolean;
};

type UpdateAgentConfigResult = { success: true } | { error: string };

type UpdateAgentConfig = (input: UpdateAgentConfigInput) => Promise<UpdateAgentConfigResult>;

export const updateAgentConfig: UpdateAgentConfig = async ({ agentId, memoryEnabled, reflectionEnabled }) => {
  try {
    await prisma.agentConfig.upsert({
      where: { agentId },
      create: { agentId, memoryEnabled, reflectionEnabled },
      update: { memoryEnabled, reflectionEnabled },
    });
    revalidatePath('/agents');
    return { success: true };
  } catch {
    return { error: 'Failed to update agent configuration' };
  }
};
