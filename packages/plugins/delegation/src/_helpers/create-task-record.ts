// Creates a task record in the database for tracking delegation state

import type { PluginContext } from "@harness/plugin-contract";

type CreateTaskRecord = (
  ctx: PluginContext,
  threadId: string,
  prompt: string,
  maxIterations: number
) => Promise<{ taskId: string }>;

export const createTaskRecord: CreateTaskRecord = async (ctx, threadId, prompt, maxIterations) => {
  const task = await ctx.db.orchestratorTask.create({
    data: {
      threadId,
      prompt,
      status: "pending",
      maxIterations,
      currentIteration: 0,
    },
  });
  return { taskId: task.id };
};
