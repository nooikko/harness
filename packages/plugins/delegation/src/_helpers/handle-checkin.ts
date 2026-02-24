// Handles the /checkin command from sub-agents — writes a system message to the parent thread

import type { PluginContext } from '@harness/plugin-contract';

type HandleCheckin = (ctx: PluginContext, threadId: string, message: string) => Promise<boolean>;

export const handleCheckin: HandleCheckin = async (ctx, threadId, message) => {
  if (!message.trim()) {
    ctx.logger.warn('Delegation: empty checkin message');
    return false;
  }

  const thread = await ctx.db.thread.findUnique({
    where: { id: threadId },
    select: { parentThreadId: true },
  });

  if (!thread?.parentThreadId) {
    ctx.logger.warn(`Delegation: checkin from thread ${threadId} with no parent`);
    return false;
  }

  await ctx.db.message.create({
    data: {
      threadId: thread.parentThreadId,
      role: 'system',
      content: `[Check-in from task thread ${threadId}]: ${message.trim()}`,
      metadata: {
        type: 'task-checkin',
        sourceThreadId: threadId,
      },
    },
  });

  await ctx
    .broadcast('task:checkin', {
      sourceThreadId: threadId,
      parentThreadId: thread.parentThreadId,
      message: message.trim(),
    })
    .catch(() => {});

  return true;
};
