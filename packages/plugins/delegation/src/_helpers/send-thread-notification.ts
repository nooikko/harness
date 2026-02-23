// Sends a cross-thread notification message to a parent thread when a task completes or fails.
// The notification is persisted as a system message with metadata containing the source thread
// and task IDs so the dashboard can render a "View thread" link.

import type { PluginContext } from '@harness/plugin-contract';

export type ThreadNotificationInput = {
  parentThreadId: string;
  taskThreadId: string;
  taskId: string;
  status: 'completed' | 'failed';
  summary: string;
  iterations: number;
};

type SendThreadNotification = (ctx: PluginContext, input: ThreadNotificationInput) => Promise<void>;

export const sendThreadNotification: SendThreadNotification = async (ctx, input) => {
  const statusLabel = input.status === 'completed' ? 'completed' : 'failed';
  const content = `Task ${statusLabel} after ${input.iterations} iteration(s): ${input.summary}`;

  await ctx.db.message.create({
    data: {
      threadId: input.parentThreadId,
      role: 'system',
      content,
      metadata: {
        type: 'cross-thread-notification',
        sourceThreadId: input.taskThreadId,
        taskId: input.taskId,
        status: input.status,
        iterations: input.iterations,
      },
    },
  });

  ctx.logger.info(`Delegation: sent ${statusLabel} notification to thread ${input.parentThreadId} for task ${input.taskId}`);

  await ctx.broadcast('thread:notification', {
    parentThreadId: input.parentThreadId,
    taskThreadId: input.taskThreadId,
    taskId: input.taskId,
    status: input.status,
  });
};
