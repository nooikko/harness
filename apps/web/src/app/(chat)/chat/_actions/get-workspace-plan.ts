'use server';

import { prisma, type WorkspacePlan } from '@harness/database';

type GetWorkspacePlan = (threadId: string) => Promise<WorkspacePlan | null>;

export const getWorkspacePlan: GetWorkspacePlan = async (threadId) => {
  if (!threadId) {
    return null;
  }

  const plan = await prisma.workspacePlan.findUnique({
    where: { threadId },
  });

  return plan;
};
