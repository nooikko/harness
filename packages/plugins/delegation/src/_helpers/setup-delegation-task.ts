// Sets up the delegation task — creates thread and task records atomically,
// fires onTaskCreate hooks, and broadcasts task creation event

import type { PluginContext, PluginHooks } from '@harness/plugin-contract';
import { runHook } from '@harness/plugin-contract';

export type DelegationOptions = {
  prompt: string;
  parentThreadId: string;
  maxIterations?: number;
  costCapUsd?: number;
  model?: string;
  traceId?: string;
};

export type SetupDelegationTaskResult = {
  threadId: string;
  taskId: string;
};

const DEFAULT_MAX_ITERATIONS = 5;

type SetupDelegationTask = (ctx: PluginContext, allHooks: PluginHooks[], options: DelegationOptions) => Promise<SetupDelegationTaskResult>;

export const setupDelegationTask: SetupDelegationTask = async (ctx, allHooks, options) => {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  // Steps 1 & 2: Create thread and task record atomically
  const { threadId, taskId } = await ctx.db.$transaction(async (tx) => {
    const thread = await tx.thread.create({
      data: {
        source: 'delegation',
        sourceId: `task-${crypto.randomUUID()}`,
        name: `Task: ${options.prompt.slice(0, 50)}`,
        kind: 'task',
        status: 'active',
        parentThreadId: options.parentThreadId,
        lastActivity: new Date(),
      },
    });

    const task = await tx.orchestratorTask.create({
      data: {
        threadId: thread.id,
        prompt: options.prompt,
        status: 'pending',
        maxIterations,
        currentIteration: 0,
      },
    });

    return { threadId: thread.id, taskId: task.id };
  });

  ctx.logger.info(`Delegation: created task ${taskId} in thread ${threadId}`, {
    parentThreadId: options.parentThreadId,
    maxIterations,
  });

  // Step 3: Fire onTaskCreate hooks
  await runHook(
    allHooks,
    'onTaskCreate',
    (hooks) => {
      if (hooks.onTaskCreate) {
        return hooks.onTaskCreate(threadId, taskId);
      }
      return undefined;
    },
    ctx.logger,
  );

  // Step 4: Broadcast task creation
  await ctx.broadcast('task:created', {
    taskId,
    threadId,
    parentThreadId: options.parentThreadId,
  });

  return { threadId, taskId };
};
