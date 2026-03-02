// Invokes Claude Haiku to generate a short thread title from the first message

import type { PluginContext } from '@harness/plugin-contract';

type GenerateThreadName = (ctx: PluginContext, content: string) => Promise<string>;

export const generateThreadName: GenerateThreadName = async (ctx, content) => {
  const prompt = `Generate a short, descriptive 5-8 word title for a chat thread that starts with this message. Reply with only the title, no quotes or punctuation at the end.\n\nMessage: ${content}`;

  const result = await ctx.invoker.invoke(prompt, {
    model: 'claude-haiku-4-5-20251001',
  });

  return result.output.trim();
};
