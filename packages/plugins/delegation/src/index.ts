// Delegation plugin — sub-agent task management with iteration control
// Exposes delegation__delegate and delegation__checkin MCP tools for Claude.
// Manages task lifecycle and enforces iteration limits via validation hooks.

import type { PluginContext, PluginDefinition, PluginHooks, PluginTool } from '@harness/plugin-contract';
import { type DelegationResult, runDelegationLoop } from './_helpers/delegation-loop';
import { createDelegationSemaphore } from './_helpers/delegation-semaphore';
import { handleCheckin } from './_helpers/handle-checkin';
import { settingsSchema } from './_helpers/settings-schema';
import type { DelegationOptions } from './_helpers/setup-delegation-task';

export type { DelegationOptions, DelegationResult };

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Delegation plugin registered');

    let settings = await ctx.getSettings(settingsSchema);

    // Store setHooks on the plugin state so the orchestrator can call it after all plugins
    // register — the tool handler uses state.currentHooks to pass allHooks to runDelegationLoop.
    type SetHooks = (hooks: PluginHooks[]) => void;
    const setHooks: SetHooks = (hooks) => {
      state.currentHooks = hooks;
    };
    state.setHooks = setHooks;
    state.getSettings = () => settings;

    return {
      onSettingsChange: async (pluginName: string) => {
        if (pluginName !== 'delegation') {
          return;
        }
        settings = await ctx.getSettings(settingsSchema);
        ctx.logger.info('Delegation plugin: settings reloaded');
      },
      onBroadcast: async (event: string, data: unknown) => {
        if (event === 'task:cancel-requested') {
          const { taskId } = data as { taskId: string };
          const cancelled = cancelTask(taskId);
          if (cancelled) {
            ctx.logger.info(`Delegation: cancel requested for task ${taskId}`);
          }
        }
      },
    };
  };

  return register;
};

const semaphore = createDelegationSemaphore();

export type DelegationPluginState = {
  setHooks: ((hooks: PluginHooks[]) => void) | null;
  currentHooks: PluginHooks[] | null;
  getSettings: (() => { maxIterations?: number; costCapUsd?: number }) | null;
  semaphore: ReturnType<typeof createDelegationSemaphore>;
  abortControllers: Map<string, AbortController>;
  cancelTask: (taskId: string) => boolean;
};

const abortControllers = new Map<string, AbortController>();

type CancelTask = (taskId: string) => boolean;

const cancelTask: CancelTask = (taskId) => {
  const controller = abortControllers.get(taskId);
  if (!controller) {
    return false;
  }
  controller.abort();
  abortControllers.delete(taskId);
  return true;
};

const state: DelegationPluginState = {
  setHooks: null,
  currentHooks: null,
  getSettings: null,
  semaphore,
  abortControllers,
  cancelTask,
};

export { state };

const delegateTools: PluginTool[] = [
  {
    name: 'delegate',
    description:
      'Spawn a sub-agent to work on a task in a separate thread. Use this when a task can be done independently and in parallel without blocking the current conversation. The sub-agent works autonomously and results are reported back when complete.',
    schema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed task description for the sub-agent. Be specific — the sub-agent has no context from this conversation.',
        },
        model: {
          type: 'string',
          description: 'Model to use (e.g. claude-sonnet-4-6). Defaults to system default.',
        },
        maxIterations: {
          type: 'number',
          description: 'Maximum validation retry attempts before giving up. Default 5.',
        },
      },
      required: ['prompt'],
    },
    handler: async (ctx, input, meta) => {
      const prompt = input.prompt as string;
      if (!prompt.trim()) {
        return 'Error: prompt is required for delegation.';
      }

      const limit = ctx.config.maxConcurrentAgents;
      if (!semaphore.tryAcquire(limit)) {
        return `Error: delegation limit reached (${limit} concurrent task(s) already running). Wait for an existing task to complete before delegating another.`;
      }

      const pluginSettings = state.getSettings?.() ?? {};

      // Create an AbortController for this task — stored by taskId after setup
      const abortController = new AbortController();

      runDelegationLoop(ctx, state.currentHooks ?? [], {
        prompt,
        parentThreadId: meta.threadId,
        model: input.model as string | undefined,
        maxIterations: (input.maxIterations as number | undefined) ?? pluginSettings.maxIterations,
        costCapUsd: pluginSettings.costCapUsd,
        traceId: meta.traceId,
        signal: abortController.signal,
        onTaskCreated: (taskId) => {
          abortControllers.set(taskId, abortController);
        },
      })
        .catch((err) => {
          ctx.logger.error(`Delegation tool failed: ${err instanceof Error ? err.message : String(err)}`);
        })
        .finally(() => {
          semaphore.release();
        });

      return 'Task delegated successfully. You will receive a notification when the sub-agent completes.';
    },
  },
  {
    name: 'checkin',
    description: 'Send a progress update to the parent thread. Use this during long-running delegated tasks to keep the user informed of progress.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The progress update message to send to the parent thread.',
        },
      },
      required: ['message'],
    },
    handler: async (ctx, input, meta) => {
      const message = input.message as string;
      const ok = await handleCheckin(ctx, meta.threadId, message);
      if (!ok) {
        return 'Error: check-in failed (empty message or no parent thread).';
      }
      return 'Check-in sent to parent thread.';
    },
  },
];

export const plugin: PluginDefinition = {
  name: 'delegation',
  version: '1.0.0',
  settingsSchema,
  register: createRegister(),
  tools: delegateTools,
};

type CreateDelegationPlugin = () => PluginDefinition;

export const createDelegationPlugin: CreateDelegationPlugin = () => ({
  name: 'delegation',
  version: '1.0.0',
  settingsSchema,
  register: createRegister(),
  tools: delegateTools,
});
