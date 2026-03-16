'use server';

import { revalidatePath } from 'next/cache';
import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';

type DisconnectResult = {
  success: boolean;
  error?: string;
};

type DisconnectAccount = () => Promise<DisconnectResult>;

export const disconnectAccount: DisconnectAccount = async () => {
  try {
    const res = await fetch(`${getOrchestratorUrl()}/api/plugins/music/oauth/disconnect`, { method: 'POST' });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        success: false,
        error: (body.error as string) ?? `Request failed (${res.status})`,
      };
    }

    revalidatePath('/admin/plugins/music');
    return { success: true };
  } catch {
    return {
      success: false,
      error: 'Could not reach orchestrator. Is it running?',
    };
  }
};
