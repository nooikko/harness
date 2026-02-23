// Creates a new thread for a delegated task, linked to the parent thread

import type { PluginContext } from '@harness/plugin-contract';

type CreateTaskThread = (ctx: PluginContext, parentThreadId: string, prompt: string) => Promise<{ threadId: string }>;

export const createTaskThread: CreateTaskThread = async (ctx, parentThreadId, prompt) => {
  const thread = await ctx.db.thread.create({
    data: {
      source: 'delegation',
      sourceId: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `Task: ${prompt.slice(0, 50)}`,
      kind: 'task',
      status: 'active',
      parentThreadId,
      lastActivity: new Date(),
    },
  });
  return { threadId: thread.id };
};
