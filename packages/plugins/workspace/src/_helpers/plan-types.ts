// Structured task graph types for WorkspacePlan.planData

export type PlanTaskStatus = 'pending' | 'delegated' | 'in_review' | 'accepted' | 'rejected' | 'failed';

export type PlanTask = {
  id: string;
  title: string;
  description: string;
  status: PlanTaskStatus;
  dependsOn: string[];
  acceptanceCriteria: string;
  assignedTaskId: string | null;
  assignedThreadId: string | null;
  result: string | null;
  reviewNotes: string | null;
  depth: number;
};

export type PlanData = {
  tasks: PlanTask[];
};

export type PlanStatus = 'planning' | 'active' | 'paused' | 'completed' | 'failed';

export const VALID_PLAN_STATUSES: PlanStatus[] = ['planning', 'active', 'paused', 'completed', 'failed'];
