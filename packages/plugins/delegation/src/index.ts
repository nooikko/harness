// Delegation plugin — sub-agent task management with iteration control
// Registers "delegate" and "re-delegate" command handlers that spawn sub-agents,
// manage task lifecycle, and enforce iteration limits via validation hooks

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { type DelegationOptions, type DelegationResult, runDelegationLoop } from './_helpers/delegation-loop';
import { handleCheckin } from './_helpers/handle-checkin';

export type { DelegationOptions, DelegationResult };

type ParseDelegateArgs = (args: string) => { prompt: string; model?: string; maxIterations?: number };

const parseDelegateArgs: ParseDelegateArgs = (args) => {
  const trimmed = args.trim();

  // Extract optional model parameter: model=<value>
  let model: string | undefined;
  const modelMatch = trimmed.match(/\bmodel=(\S+)/);
  if (modelMatch?.[1]) {
    model = modelMatch[1];
  }

  // Extract optional maxIterations parameter: maxIterations=<value>
  let maxIterations: number | undefined;
  const iterMatch = trimmed.match(/\bmaxIterations=(\d+)/);
  if (iterMatch?.[1]) {
    const parsed = Number.parseInt(iterMatch[1], 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      maxIterations = parsed;
    }
  }

  // Remove parameter tokens to get the prompt (strip all maxIterations=<value> tokens, valid or not)
  const prompt = trimmed
    .replace(/\bmodel=\S+/, '')
    .replace(/\bmaxIterations=\S+/, '')
    .trim();

  return { prompt, model, maxIterations };
};

type HandleDelegateCommand = (ctx: PluginContext, allHooks: PluginHooks[], threadId: string, args: string) => Promise<boolean>;

const handleDelegateCommand: HandleDelegateCommand = async (ctx, allHooks, threadId, args) => {
  const { prompt, model, maxIterations } = parseDelegateArgs(args);

  if (!prompt) {
    ctx.logger.warn('Delegation: empty prompt in delegate command');
    return false;
  }

  const options: DelegationOptions = {
    prompt,
    parentThreadId: threadId,
    model,
    maxIterations,
  };

  runDelegationLoop(ctx, allHooks, options)
    .then((result) => {
      ctx.logger.info('Delegation: delegate command finished', {
        taskId: result.taskId,
        status: result.status,
        iterations: result.iterations,
      });
    })
    .catch((err) => {
      ctx.logger.error(`Delegation: delegate command failed: ${err instanceof Error ? err.message : String(err)}`);
    });

  return true;
};

type HandleRedelegateCommand = (ctx: PluginContext, allHooks: PluginHooks[], threadId: string, args: string) => Promise<boolean>;

const handleRedelegateCommand: HandleRedelegateCommand = async (ctx, allHooks, threadId, args) => {
  // Re-delegate reuses the same logic as delegate but is triggered
  // when validation rejects and the agent explicitly requests re-delegation
  const { prompt, model, maxIterations } = parseDelegateArgs(args);

  if (!prompt) {
    ctx.logger.warn('Delegation: empty prompt in re-delegate command');
    return false;
  }

  const options: DelegationOptions = {
    prompt,
    parentThreadId: threadId,
    model,
    maxIterations,
  };

  runDelegationLoop(ctx, allHooks, options)
    .then((result) => {
      ctx.logger.info('Delegation: re-delegate command finished', {
        taskId: result.taskId,
        status: result.status,
        iterations: result.iterations,
      });
    })
    .catch((err) => {
      ctx.logger.error(`Delegation: re-delegate command failed: ${err instanceof Error ? err.message : String(err)}`);
    });

  return true;
};

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Delegation plugin registered');

    // Capture a reference to allHooks that will be populated after all plugins register.
    // The orchestrator calls register() on all plugins first, then the hooks are available.
    // We use a lazy accessor so the onCommand handler always sees the current hooks.
    let resolvedHooks: PluginHooks[] = [];

    type SetHooks = (hooks: PluginHooks[]) => void;
    const setHooks: SetHooks = (hooks) => {
      resolvedHooks = hooks;
    };

    // Store setHooks on the plugin state for the orchestrator to call
    pluginState.setHooks = setHooks;

    return {
      onCommand: async (threadId, command, args) => {
        if (command === 'delegate') {
          return handleDelegateCommand(ctx, resolvedHooks, threadId, args);
        }
        if (command === 're-delegate') {
          return handleRedelegateCommand(ctx, resolvedHooks, threadId, args);
        }
        if (command === 'checkin') {
          return handleCheckin(ctx, threadId, args);
        }
        return false;
      },
    };
  };

  return register;
};

export type DelegationPluginState = {
  setHooks: ((hooks: PluginHooks[]) => void) | null;
};

const pluginState: DelegationPluginState = {
  setHooks: null,
};

export const plugin: PluginDefinition = {
  name: 'delegation',
  version: '1.0.0',
  register: createRegister(),
};

type CreateDelegationPlugin = () => PluginDefinition;

export const createDelegationPlugin: CreateDelegationPlugin = () => ({
  name: 'delegation',
  version: '1.0.0',
  register: createRegister(),
});

export { parseDelegateArgs };
