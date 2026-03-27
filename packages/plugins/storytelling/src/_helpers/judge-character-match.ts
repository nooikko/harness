import type { PluginContext } from '@harness/plugin-contract';

type SimilarCharacter = {
  characterId: string;
  name: string;
  score: number;
};

type ExtractedCharacter = {
  name: string;
  description: string;
};

type JudgeCharacterMatch = (
  ctx: PluginContext,
  extracted: ExtractedCharacter,
  candidates: SimilarCharacter[],
  existingDescriptions: Map<string, string>,
) => Promise<string | null>;

export const judgeCharacterMatch: JudgeCharacterMatch = async (ctx, extracted, candidates, existingDescriptions) => {
  const candidateList = candidates
    .map((c, i) => {
      const desc = existingDescriptions.get(c.characterId) ?? '';
      return `[${i + 1}] "${c.name}" — ${desc || 'no description'}`;
    })
    .join('\n');

  const prompt = `You are identifying whether a newly extracted character from a story transcript matches any existing character record.

New character: "${extracted.name}" — ${extracted.description || 'no description'}

Existing candidates:
${candidateList}

Rules:
- A person can appear under different names, nicknames, or descriptions at different times
- Assume they are the same person UNLESS descriptions directly contradict (different genders, impossible overlap)
- "the tall guy from class" and "grey sweatpants" CAN be the same person if context allows

Reply with ONLY the number (e.g., "1") of the matching candidate, or "none" if this is a new character.`;

  const result = await ctx.invoker.invoke(prompt, {
    model: 'claude-haiku-4-5-20251001',
    threadId: 'storytelling-judge',
    timeout: 30_000,
  });
  const output = result.output.trim().toLowerCase();

  if (output === 'none') {
    return null;
  }

  const match = output.match(/^(\d+)/);
  if (!match) {
    return null;
  }

  const index = Number.parseInt(match[1]!, 10) - 1;
  const matched = candidates[index];
  return matched?.characterId ?? null;
};
