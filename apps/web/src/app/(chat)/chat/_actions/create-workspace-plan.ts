'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type CreateWorkspacePlanParams = {
  threadId: string;
  objective: string;
  maxDepth?: number;
};

type CreateWorkspacePlanResult = { success: true; id: string } | { error: string };

type CreateWorkspacePlan = (params: CreateWorkspacePlanParams) => Promise<CreateWorkspacePlanResult>;

export const createWorkspacePlan: CreateWorkspacePlan = async ({ threadId, objective, maxDepth = 3 }) => {
  if (!threadId) {
    return { error: 'Thread ID is required' };
  }

  if (!objective?.trim()) {
    return { error: 'Objective is required' };
  }

  try {
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      return { error: 'Thread not found' };
    }

    const plan = await prisma.workspacePlan.create({
      data: {
        threadId,
        objective,
        status: 'planning',
        planData: { tasks: [] },
        maxDepth,
      },
    });

    revalidatePath('/chat');

    return { success: true, id: plan.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
};
