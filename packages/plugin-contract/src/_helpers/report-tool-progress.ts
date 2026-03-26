import type { InvokeStreamEvent, PluginContext, PluginToolMeta } from '../index';

type ProgressDetail = {
  current?: number;
  total?: number;
};

type ReportProgress = (message: string, detail?: ProgressDetail) => void;

type ToolProgressReporter = {
  reportProgress: ReportProgress;
  /** Collected progress events — the tool server reads this after handler returns
   *  to merge into the pipeline's streamEvents array for persistence. */
  events: InvokeStreamEvent[];
};

type CreateToolProgressReporter = (ctx: PluginContext, meta: PluginToolMeta, toolName: string) => ToolProgressReporter;

export const createToolProgressReporter: CreateToolProgressReporter = (ctx, meta, toolName) => {
  const events: InvokeStreamEvent[] = [];
  let lastBroadcastMs = 0;
  const DEBOUNCE_MS = 500;

  const reportProgress: ReportProgress = (message, detail) => {
    const now = Date.now();
    const event: InvokeStreamEvent = {
      type: 'tool_progress',
      toolName,
      content: message,
      timestamp: now,
      ...(detail?.current !== undefined ? { current: detail.current } : {}),
      ...(detail?.total !== undefined ? { total: detail.total } : {}),
      ...(meta.traceId ? { traceId: meta.traceId } : {}),
    } as InvokeStreamEvent;

    // Always capture for persistence
    events.push(event);

    // Debounce broadcasts to avoid WebSocket spam from tight loops
    if (now - lastBroadcastMs >= DEBOUNCE_MS) {
      lastBroadcastMs = now;
      void ctx.broadcast('pipeline:stream', {
        threadId: meta.threadId,
        event,
      });
    }
  };

  return { reportProgress, events };
};
