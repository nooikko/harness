// Generates a summary of recent thread messages using a sub-agent invocation

import type { PluginContext } from '@harness/plugin-contract';

const DEFAULT_PROMPT =
  'Summarize this conversation into a brief, structured overview. Focus on: key decisions made, important context established, and any pending action items. Do NOT repeat or echo individual messages — synthesize them into a compact summary. Keep it under 300 words. Output only the summary, no preamble:';

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
