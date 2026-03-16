'use server';

import { revalidatePath } from 'next/cache';
import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';

type SetDeviceAliasResult = {
  success: boolean;
  error?: string;
};

type SetDeviceAlias = (deviceId: string, alias: string) => Promise<SetDeviceAliasResult>;

export const setDeviceAlias: SetDeviceAlias = async (deviceId, alias) => {
  try {
    const res = await fetch(`${getOrchestratorUrl()}/api/plugins/music/devices/alias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, alias }),
    });

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
