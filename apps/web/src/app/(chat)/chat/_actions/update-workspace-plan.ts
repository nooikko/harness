'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

const VALID_STATUSES = ['planning', 'active', 'paused', 'completed', 'failed'] as const;

type PlanStatus = (typeof VALID_STATUSES)[number];

type UpdateWorkspacePlanParams = {
  planId: string;
  status?: string;
  planData?: Record<string, unknown>;
};

type UpdateWorkspacePlanResult = { success: true } | { error: string };

type UpdateWorkspacePlan = (params: UpdateWorkspacePlanParams) => Promise<UpdateWorkspacePlanResult>;

export const updateWorkspacePlan: UpdateWorkspacePlan = async ({ planId, status, planData }) => {
  if (!planId) {
    return { error: 'Plan ID is required' };
  }

  if (status !== undefined && !VALID_STATUSES.includes(status as PlanStatus)) {
    return { error: 'Invalid status' };
  }

  const data: Record<string, unknown> = {};
  if (status !== undefined) {
    data.status = status;
  }
  if (planData !== undefined) {
    data.planData = planData;
  }

  if (Object.keys(data).length === 0) {
    return { error: 'No fields to update' };
  }

  try {
    const existing = await prisma.workspacePlan.findUnique({
      where: { id: planId },
    });

    if (!existing) {
      return { error: 'Plan not found' };
    }

    await prisma.workspacePlan.update({
      where: { id: planId },
      data,
    });

    revalidatePath('/chat');

    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
};
