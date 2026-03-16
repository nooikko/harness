'use server';

import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';

type OAuthInitiateResult = {
  success: boolean;
  userCode?: string;
  verificationUrl?: string;
  expiresIn?: number;
  error?: string;
};

type InitiateOAuth = () => Promise<OAuthInitiateResult>;

export const initiateOAuth: InitiateOAuth = async () => {
  try {
    const res = await fetch(`${getOrchestratorUrl()}/api/plugins/music/oauth/initiate`, { method: 'POST' });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        success: false,
        error: (body.error as string) ?? `Request failed (${res.status})`,
      };
    }

    const data = (await res.json()) as {
      userCode: string;
      verificationUrl: string;
      expiresIn: number;
    };
    return {
      success: true,
      userCode: data.userCode,
      verificationUrl: data.verificationUrl,
      expiresIn: data.expiresIn,
    };
  } catch {
    return {
      success: false,
      error: 'Could not reach orchestrator. Is it running?',
    };
  }
};
