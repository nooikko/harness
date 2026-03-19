'use server';

import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';
import { logServerError } from '@/lib/log-server-error';

type RequestAuditDeleteResult = { ok: boolean; error?: string };

type RequestAuditDelete = (threadId: string) => Promise<RequestAuditDeleteResult>;

export const requestAuditDelete: RequestAuditDelete = async (threadId) => {
  try {
    void fetch(`${getOrchestratorUrl()}/api/audit-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
    });

    return { ok: true };
  } catch (err) {
    logServerError({ action: 'requestAuditDelete', error: err, context: { threadId } });
    return { ok: false, error: 'Orchestrator unreachable' };
  }
};
