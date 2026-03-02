// Generates a summary of recent thread messages using a sub-agent invocation

import type { PluginContext } from '@harness/plugin-contract';

type GenerateSummary = (ctx: PluginContext, threadId: string, messageCount: number) => Promise<string>;

export const generateSummary: GenerateSummary = async (ctx, threadId, messageCount) => {
  const recentMessages = await ctx.db.message.findMany({
    where: { threadId, kind: 'text' },
    orderBy: { createdAt: 'asc' },
    take: messageCount,
    select: { role: true, content: true },
  });

  const historyText = recentMessages.map((m) => `[${m.role}]: ${m.content}`).join('\n\n');

  const prompt = `Please provide a concise summary of this conversation that captures the key points, decisions, and context needed to continue the conversation effectively:\n\n${historyText}`;

  const result = await ctx.invoker.invoke(prompt, {
    model: 'claude-haiku-4-5-20251001',
  });

  return result.output;
};
