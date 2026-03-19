// Invokes Claude Haiku to generate a short thread title from the first message

import type { PluginContext } from '@harness/plugin-contract';

const DEFAULT_PROMPT =
  'Generate a short, descriptive 5-8 word title for a chat thread that starts with this message. Reply with only the title, no quotes or punctuation at the end.';

type GenerateThreadName = (ctx: PluginContext, content: string, customPrompt?: string) => Promise<string>;

export const generateThreadName: GenerateThreadName = async (ctx, content, customPrompt) => {
  const prompt = `${customPrompt || DEFAULT_PROMPT}\n\nMessage: ${content}`;

  const result = await ctx.invoker.invoke(prompt, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 30,
  });

  if (result.error || (result.exitCode !== null && result.exitCode !== 0)) {
    return '';
  }

  const MAX_NAME_LENGTH = 100;
  const name = result.output.trim();
  return name.length > MAX_NAME_LENGTH ? name.slice(0, MAX_NAME_LENGTH) : name;
};
