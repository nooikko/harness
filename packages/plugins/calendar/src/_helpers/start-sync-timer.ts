import type { PluginContext } from '@harness/plugin-contract';
import { projectVirtualEvents } from './project-virtual-events';
import { syncOutlookCalendars } from './sync-outlook-calendars';

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const PROJECTION_INTERVAL_MS = 60 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | null = null;
let projectionTimer: ReturnType<typeof setInterval> | null = null;

type StartSyncTimer = (ctx: PluginContext) => void;

const startSyncTimer: StartSyncTimer = (ctx) => {
  stopSyncTimer();

  syncTimer = setInterval(() => {
    void (async () => {
      try {
        await syncOutlookCalendars(ctx);
      } catch (err) {
        ctx.logger.warn(`calendar: sync timer error — ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }, SYNC_INTERVAL_MS);

  projectionTimer = setInterval(() => {
    void (async () => {
      try {
        await projectVirtualEvents(ctx);
      } catch (err) {
        ctx.logger.warn(`calendar: projection timer error — ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }, PROJECTION_INTERVAL_MS);

  ctx.logger.info(`calendar: sync timer started (${SYNC_INTERVAL_MS / 1000}s interval)`);
};

type StopSyncTimer = () => void;

const stopSyncTimer: StopSyncTimer = () => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  if (projectionTimer) {
    clearInterval(projectionTimer);
    projectionTimer = null;
  }
};

export { startSyncTimer, stopSyncTimer };
