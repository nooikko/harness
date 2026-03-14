'use server';

import Anthropic from '@anthropic-ai/sdk';

type RewriteWithAi = (text: string, field: 'description' | 'instructions') => Promise<string>;

const PROMPTS: Record<'description' | 'instructions', string> = {
  description:
    'Rewrite the following project description to be clear, concise, and informative. Keep it to 1-2 sentences that explain what the project is about. Return only the rewritten text, no explanation.',
  instructions:
    'Rewrite the following project instructions to be effective system instructions for a Claude AI agent. Make them clear, specific, and actionable. Use imperative tone. Organize with bullet points if appropriate. Return only the rewritten instructions, no explanation or preamble.',
};

export const rewriteWithAi: RewriteWithAi = async (text, field) => {
  if (!text.trim()) {
    throw new Error('No text to rewrite.');
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `${PROMPTS[field]}\n\n---\n\n${text}`,
      },
    ],
  });

  const block = response.content[0];
  if (block?.type !== 'text') {
    throw new Error('Unexpected response from AI.');
  }

  return block.text;
};
