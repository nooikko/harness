'use server';

import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';

type PrewarmSession = (threadId: string) => Promise<void>;

export const prewarmSession: PrewarmSession = async (threadId) => {
  try {
    await fetch(`${getOrchestratorUrl()}/api/prewarm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
    });
  } catch {
    // Best-effort — silently ignore prewarm failures
  }
};
