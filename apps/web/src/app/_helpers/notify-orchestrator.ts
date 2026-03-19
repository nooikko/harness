import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';
import { webLogger } from '@/lib/logger';

type NotifyOrchestrator = (event: string, data: unknown) => Promise<void>;

export const notifyOrchestrator: NotifyOrchestrator = async (event, data) => {
  try {
    await fetch(`${getOrchestratorUrl()}/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data }),
    });
  } catch (err) {
    webLogger.warn('notifyOrchestrator: failed', { event, error: err instanceof Error ? err.message : String(err) });
  }
};
