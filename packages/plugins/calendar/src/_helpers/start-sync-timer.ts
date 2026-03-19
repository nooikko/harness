import type { PluginContext } from '@harness/plugin-contract';
import { projectVirtualEvents } from './project-virtual-events';
import { syncGoogleCalendars } from './sync-google-calendars';
import { syncOutlookCalendars } from './sync-outlook-calendars';

const OUTLOOK_SYNC_INTERVAL_MS = 30 * 60 * 1000;
const GOOGLE_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const PROJECTION_INTERVAL_MS = 60 * 60 * 1000;

let outlookSyncTimer: ReturnType<typeof setInterval> | null = null;
let googleSyncTimer: ReturnType<typeof setInterval> | null = null;
let projectionTimer: ReturnType<typeof setInterval> | null = null;

type StartSyncTimer = (ctx: PluginContext) => void;

const startSyncTimer: StartSyncTimer = (ctx) => {
  stopSyncTimer();

  outlookSyncTimer = setInterval(() => {
    void (async () => {
      try {
        await syncOutlookCalendars(ctx);
      } catch (err) {
        ctx.logger.warn(`calendar: outlook sync timer error — ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }, OUTLOOK_SYNC_INTERVAL_MS);

  googleSyncTimer = setInterval(() => {
    void (async () => {
      try {
        await syncGoogleCalendars(ctx);
      } catch (err) {
        ctx.logger.warn(`calendar: google sync timer error — ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }, GOOGLE_SYNC_INTERVAL_MS);

  projectionTimer = setInterval(() => {
    void (async () => {
      try {
        await projectVirtualEvents(ctx);
      } catch (err) {
        ctx.logger.warn(`calendar: projection timer error — ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }, PROJECTION_INTERVAL_MS);

  ctx.logger.info(`calendar: sync timers started (outlook: ${OUTLOOK_SYNC_INTERVAL_MS / 1000}s, google: ${GOOGLE_SYNC_INTERVAL_MS / 1000}s)`);
};

type StopSyncTimer = () => void;

const stopSyncTimer: StopSyncTimer = () => {
  if (outlookSyncTimer) {
    clearInterval(outlookSyncTimer);
    outlookSyncTimer = null;
  }
  if (googleSyncTimer) {
    clearInterval(googleSyncTimer);
    googleSyncTimer = null;
  }
  if (projectionTimer) {
    clearInterval(projectionTimer);
    projectionTimer = null;
  }
};

export { startSyncTimer, stopSyncTimer };
