// Compound operation: creates both a task Thread and an OrchestratorTask
// in a single transaction, with defaults based on kind. This is NOT a
// Prisma wrapper — it encodes the multi-step business logic of starting
// a delegation: thread creation + task creation + linking + defaults.

import type { PluginContext } from '@harness/plugin-contract';

export type StartDelegationInput = {
  parentThreadId: string;
  prompt: string;
  model?: string;
  maxIterations?: number;
};

export type StartDelegationResult = {
  taskId: string;
  threadId: string;
};

const DEFAULT_MAX_ITERATIONS = 5;

type StartDelegation = (ctx: PluginContext, input: StartDelegationInput) => Promise<StartDelegationResult>;

export const startDelegation: StartDelegation = async (ctx, input) => {
  const maxIterations = input.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const sourceId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const threadName = `Task: ${input.prompt.slice(0, 50)}`;

  const [thread, task] = await ctx.db.$transaction(async (tx) => {
    const createdThread = await tx.thread.create({
      data: {
        source: 'delegation',
        sourceId,
        name: threadName,
        kind: 'task',
        status: 'active',
        parentThreadId: input.parentThreadId,
        lastActivity: new Date(),
      },
    });

    const createdTask = await tx.orchestratorTask.create({
      data: {
        threadId: createdThread.id,
        prompt: input.prompt,
        status: 'pending',
        maxIterations,
        currentIteration: 0,
      },
    });

    return [createdThread, createdTask] as const;
  });

  ctx.logger.info(`Delegation started: task ${task.id} in thread ${thread.id}`, {
    parentThreadId: input.parentThreadId,
    maxIterations,
  });

  return { taskId: task.id, threadId: thread.id };
};
