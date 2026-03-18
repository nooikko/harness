// Generates a summary of recent thread messages using a sub-agent invocation

import type { PluginContext } from '@harness/plugin-contract';

const DEFAULT_PROMPT =
  'Please provide a concise summary of this conversation that captures the key points, decisions, and context needed to continue the conversation effectively:';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

type GenerateSummary = (ctx: PluginContext, threadId: string, messageCount: number, customPrompt?: string, model?: string) => Promise<string>;

export const generateSummary: GenerateSummary = async (ctx, threadId, messageCount, customPrompt, model) => {
  const recentMessages = await ctx.db.message.findMany({
    where: { threadId, kind: 'text' },
    orderBy: { createdAt: 'asc' },
    take: messageCount,
    select: { role: true, content: true },
  });

  const historyText = recentMessages.map((m) => `[${m.role}]: ${m.content}`).join('\n\n');

  const prompt = `${customPrompt || DEFAULT_PROMPT}\n\n${historyText}`;

  const result = await ctx.invoker.invoke(prompt, {
    model: model ?? DEFAULT_MODEL,
  });

  if (!result.output.trim()) {
    throw new Error('Haiku returned empty summary output');
  }

  return result.output;
};
