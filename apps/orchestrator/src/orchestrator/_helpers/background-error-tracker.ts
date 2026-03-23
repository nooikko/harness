// Tracks fire-and-forget background task errors per plugin.
// Aggregates error counts and surfaces them via the status registry when a
// threshold is reached, so silent failures become visible.

import type { Logger } from "@harness/logger";
import type { PluginStatusRegistry } from "./plugin-status-registry";

type ErrorEntry = {
  count: number;
  lastError: string;
  lastOccurred: number;
};

export type BackgroundErrorTracker = {
  report: (pluginName: string, taskName: string, error: Error) => void;
  getErrors: (pluginName: string) => Record<string, ErrorEntry>;
  getAllErrors: () => Record<string, Record<string, ErrorEntry>>;
  reset: (pluginName: string) => void;
};

/** Errors above this threshold within the decay window trigger a degraded status report. */
const DEGRADED_THRESHOLD = 5;

/** Window in ms over which error counts decay. Errors older than this are cleared on next report. */
const DECAY_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type CreateBackgroundErrorTracker = (
  logger: Logger,
  statusRegistry: PluginStatusRegistry,
) => BackgroundErrorTracker;

export const createBackgroundErrorTracker: CreateBackgroundErrorTracker = (
  logger,
  statusRegistry,
) => {
  const errors = new Map<string, Map<string, ErrorEntry>>();

  const report = (pluginName: string, taskName: string, error: Error) => {
    logger.error(
      `Background task failed [plugin=${pluginName}, task=${taskName}]: ${error.message}`,
      { pluginName, taskName, stack: error.stack },
    );

    let pluginErrors = errors.get(pluginName);
    if (!pluginErrors) {
      pluginErrors = new Map();
      errors.set(pluginName, pluginErrors);
    }

    const now = Date.now();
    const existing = pluginErrors.get(taskName);

    // Decay: if the last error was outside the window, reset the count
    if (existing && now - existing.lastOccurred > DECAY_WINDOW_MS) {
      pluginErrors.delete(taskName);
    }

    const prev = pluginErrors.get(taskName);
    const entry: ErrorEntry = {
      count: (prev?.count ?? 0) + 1,
      lastError: error.message,
      lastOccurred: now,
    };
    pluginErrors.set(taskName, entry);

    // Escalate to status registry when threshold is breached
    if (entry.count >= DEGRADED_THRESHOLD) {
      statusRegistry.report(pluginName, "degraded", `Background task "${taskName}" failing repeatedly (${entry.count} errors in 15m)`, {
        taskName,
        errorCount: entry.count,
        lastError: error.message,
      });
    }
  };

  const getErrors = (pluginName: string): Record<string, ErrorEntry> => {
    const pluginErrors = errors.get(pluginName);
    if (!pluginErrors) {
      return {};
    }
    return Object.fromEntries(pluginErrors);
  };

  const getAllErrors = (): Record<string, Record<string, ErrorEntry>> => {
    const result: Record<string, Record<string, ErrorEntry>> = {};
    for (const [pluginName, pluginErrors] of errors) {
      result[pluginName] = Object.fromEntries(pluginErrors);
    }
    return result;
  };

  const reset = (pluginName: string) => {
    errors.delete(pluginName);
  };

  return { report, getErrors, getAllErrors, reset };
};
