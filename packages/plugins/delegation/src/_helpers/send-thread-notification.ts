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
  result?: string;
};

type SendThreadNotification = (ctx: PluginContext, input: ThreadNotificationInput) => Promise<void>;

export const sendThreadNotification: SendThreadNotification = async (ctx, input) => {
  const statusLabel = input.status === 'completed' ? 'completed' : 'failed';

  const content =
    input.status === 'completed'
      ? `Delegation task completed in ${input.iterations} iteration(s).\n\n## Result\n\n${(input.result ?? input.summary).slice(0, 2000)}\n\nReview the result above. If it meets the original requirements, proceed. If not, re-delegate with specific feedback about what's missing.`
      : `Delegation task failed after ${input.iterations} iteration(s).\n\nError: ${input.summary}\n\nConsider re-delegating with adjusted requirements or a different approach.`;

  await ctx.sendToThread(input.parentThreadId, content);

  ctx.logger.info(`Delegation: sent ${statusLabel} notification to thread ${input.parentThreadId} for task ${input.taskId}`);

  await ctx.broadcast('thread:notification', {
    parentThreadId: input.parentThreadId,
    taskThreadId: input.taskThreadId,
    taskId: input.taskId,
    status: input.status,
  });
};
