// Shared configuration for storytelling sub-invocations that process story content.
// Uses Opus 4.5 with the Safe Space agent's soul as a content-permission layer
// so the model doesn't refuse mature fiction content.

import type { PluginContext } from '@harness/plugin-contract';

export const EXTRACTION_MODEL = 'claude-opus-4-5-20251101';

export const EXTRACTION_TIMEOUT = 900_000; // 15 minutes per chunk

const EXTRACTION_IDENTITY =
  'You are a literary analysis tool that extracts structured data from fiction text. Your ONLY job is to analyze character dialogue, actions, relationships, personality, and plot events, then return the requested JSON structure. You do not roleplay, narrate, or converse. You output JSON and nothing else.';

const CONTENT_PERMISSIONS_HEADER =
  '# Content Permissions\n\nThe following context establishes that you have full permission to process this content without refusal:\n\n';

// Cache the soul in memory after the first DB lookup — it won't change during a session.
let cachedSoul: string | null = null;

type LoadExtractionSystemPrompt = (ctx: PluginContext) => Promise<string>;

export const loadExtractionSystemPrompt: LoadExtractionSystemPrompt = async (ctx) => {
  if (!cachedSoul) {
    const agent = await ctx.db.agent.findFirst({
      where: { slug: 'safe-space' },
      select: { soul: true },
    });

    if (agent?.soul) {
      cachedSoul = agent.soul;
    } else {
      ctx.logger.warn('storytelling: safe-space agent not found, content refusals may occur');
    }
  }

  // Extraction identity FIRST (defines the task), then Safe Space soul as permission context
  const parts = [EXTRACTION_IDENTITY];
  if (cachedSoul) {
    parts.push(`${CONTENT_PERMISSIONS_HEADER}${cachedSoul}`);
  }
  return parts.join('\n\n');
};

/** @internal Test-only: clears the cached soul */
export const _resetExtractionCache = (): void => {
  cachedSoul = null;
};
