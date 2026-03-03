// notify-cron-reload — fire-and-forget POST to orchestrator to hot-reload cron jobs

import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';

type NotifyCronReload = () => Promise<void>;

export const notifyCronReload: NotifyCronReload = async () => {
  try {
    await fetch(`${getOrchestratorUrl()}/api/plugins/cron/reload`, {
      method: 'POST',
    });
  } catch {
    // Swallowed — orchestrator may not be running (same pattern as save-plugin-settings.ts)
  }
};
