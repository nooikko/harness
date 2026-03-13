import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';

type NotifyOrchestrator = (event: string, data: unknown) => Promise<void>;

export const notifyOrchestrator: NotifyOrchestrator = async (event, data) => {
  try {
    await fetch(`${getOrchestratorUrl()}/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data }),
    });
  } catch {
    // Fire-and-forget — orchestrator unavailability should not break uploads
  }
};
