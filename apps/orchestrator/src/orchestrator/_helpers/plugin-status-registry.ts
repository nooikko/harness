// In-memory registry for plugin runtime status.
// Plugins report status via ctx.reportStatus(); the registry stores and broadcasts changes.

import type { PluginStatus, PluginStatusLevel } from '@harness/plugin-contract';

type BroadcastFn = (event: string, data: unknown) => Promise<void>;

type PluginStatusEntry = PluginStatus & { name: string };

export type PluginStatusRegistry = {
  report: (pluginName: string, level: PluginStatusLevel, message?: string, details?: Record<string, unknown>) => void;
  get: (pluginName: string) => PluginStatusEntry | undefined;
  getAll: () => PluginStatusEntry[];
  clear: () => void;
};

type CreatePluginStatusRegistry = (broadcast: BroadcastFn) => PluginStatusRegistry;

export const createPluginStatusRegistry: CreatePluginStatusRegistry = (broadcast) => {
  const statuses = new Map<string, PluginStatusEntry>();

  return {
    report: (pluginName, level, message, details) => {
      const existing = statuses.get(pluginName);
      // Only update + broadcast if the status actually changed
      if (existing && existing.level === level && existing.message === message) {
        return;
      }

      const entry: PluginStatusEntry = {
        name: pluginName,
        level,
        message,
        since: Date.now(),
        details,
      };
      statuses.set(pluginName, entry);

      // Fire-and-forget broadcast — status reporting must never block the caller
      void broadcast('plugin:status-changed', { pluginName, status: entry });
    },

    get: (pluginName) => statuses.get(pluginName),

    getAll: () => [...statuses.values()],

    clear: () => statuses.clear(),
  };
};
