// Delegation plugin — sub-agent task management with iteration control
// Exposes delegation__delegate and delegation__checkin MCP tools for Claude.
// Manages task lifecycle and enforces iteration limits via validation hooks.

import type { PluginContext, PluginDefinition, PluginHooks, PluginTool } from '@harness/plugin-contract';
import { type DelegationOptions, type DelegationResult, runDelegationLoop } from './_helpers/delegation-loop';
import { handleCheckin } from './_helpers/handle-checkin';

export type { DelegationOptions, DelegationResult };

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Delegation plugin registered');

    // Store setHooks on the plugin state so the orchestrator can call it after all plugins
    // register — the tool handler uses state.currentHooks to pass allHooks to runDelegationLoop.
    type SetHooks = (hooks: PluginHooks[]) => void;
    const setHooks: SetHooks = (hooks) => {
      state.currentHooks = hooks;
    };
    state.setHooks = setHooks;

    return {};
  };

  return register;
};

export type DelegationPluginState = {
  setHooks: ((hooks: PluginHooks[]) => void) | null;
  currentHooks: PluginHooks[] | null;
};

const state: DelegationPluginState = {
  setHooks: null,
  currentHooks: null,
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

      runDelegationLoop(ctx, state.currentHooks ?? [], {
        prompt,
        parentThreadId: meta.threadId,
        model: input.model as string | undefined,
        maxIterations: input.maxIterations as number | undefined,
      }).catch((err) => {
        ctx.logger.error(`Delegation tool failed: ${err instanceof Error ? err.message : String(err)}`);
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
  register: createRegister(),
  tools: delegateTools,
};

type CreateDelegationPlugin = () => PluginDefinition;

export const createDelegationPlugin: CreateDelegationPlugin = () => ({
  name: 'delegation',
  version: '1.0.0',
  register: createRegister(),
  tools: delegateTools,
});
