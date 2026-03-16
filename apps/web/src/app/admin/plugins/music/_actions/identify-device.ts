'use server';

import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';

type IdentifyDeviceResult = {
  success: boolean;
  error?: string;
};

type IdentifyDevice = (deviceId: string) => Promise<IdentifyDeviceResult>;

export const identifyDevice: IdentifyDevice = async (deviceId) => {
  try {
    const res = await fetch(`${getOrchestratorUrl()}/api/plugins/music/identify-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        success: false,
        error: (body.error as string) ?? `Request failed (${res.status})`,
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: 'Could not reach orchestrator. Is it running?',
    };
  }
};
