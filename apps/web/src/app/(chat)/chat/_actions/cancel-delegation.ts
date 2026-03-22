'use server';

import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';

type CancelDelegationResult = { success: true } | { error: string };

type CancelDelegation = (taskId: string) => Promise<CancelDelegationResult>;

export const cancelDelegation: CancelDelegation = async (taskId) => {
  if (!taskId) {
    return { error: 'Missing taskId' };
  }

  try {
    const res = await fetch(`${getOrchestratorUrl()}/api/tasks/${encodeURIComponent(taskId)}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        error: (body as { error?: string }).error ?? `Cancel failed (${res.status})`,
      };
    }

    return { success: true };
  } catch {
    return {
      error: 'Could not reach orchestrator. Is it running?',
    };
  }
};
