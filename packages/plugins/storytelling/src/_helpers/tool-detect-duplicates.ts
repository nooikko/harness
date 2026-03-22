import type { PluginContext } from '@harness/plugin-contract';
import { z } from 'zod';
import { buildDuplicateDetectionPrompt } from './build-duplicate-detection-prompt';

const MAX_MOMENTS_PER_BATCH = 50;

const DuplicateResultSchema = z.object({
  duplicates: z.array(
    z.object({
      momentA: z.string(),
      momentB: z.string(),
      canonicalId: z.string(),
      differences: z.string(),
      confidence: z.enum(['high', 'medium', 'low']),
      isDrift: z.boolean(),
      explanation: z.string(),
    }),
  ),
});

type HandleDetectDuplicates = (ctx: PluginContext, storyId: string, input: { scope?: string }) => Promise<string>;

export const handleDetectDuplicates: HandleDetectDuplicates = async (ctx, storyId, input) => {
  // Load moments based on scope
  const where: Record<string, unknown> = { storyId, deletedAt: null };

  if (input.scope && input.scope !== 'all') {
    // Try to interpret as a character name filter
    const character = await ctx.db.storyCharacter.findFirst({
      where: { storyId, name: { contains: input.scope, mode: 'insensitive' } },
      select: { id: true },
    });

    if (character) {
      where.characters = { some: { characterId: character.id } };
    }
    // Otherwise treat as storyTime range (e.g., "Day 7-11")
    // For simplicity, we filter client-side after loading
  }

  const moments = await ctx.db.storyMoment.findMany({
    where,
    select: {
      id: true,
      summary: true,
      storyTime: true,
      kind: true,
      importance: true,
      characters: { select: { characterName: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  if (moments.length === 0) {
    return 'No moments found to analyze for duplicates.';
  }

  const momentRefs = moments.map(
    (m: { id: string; summary: string; storyTime: string | null; kind: string; importance: number; characters: { characterName: string }[] }) => ({
      id: m.id,
      summary: m.summary,
      storyTime: m.storyTime,
      kind: m.kind,
      importance: m.importance,
      characterNames: m.characters.map((c: { characterName: string }) => c.characterName),
    }),
  );

  // Auto-paginate if too many moments (C2 fix)
  const batches: (typeof momentRefs)[] = [];
  for (let i = 0; i < momentRefs.length; i += MAX_MOMENTS_PER_BATCH) {
    batches.push(momentRefs.slice(i, i + MAX_MOMENTS_PER_BATCH));
  }

  const allDuplicates: z.infer<typeof DuplicateResultSchema>['duplicates'] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    const prompt = buildDuplicateDetectionPrompt({
      moments: batch,
      windowLabel: batches.length > 1 ? `batch ${i + 1}/${batches.length}` : undefined,
    });

    const result = await ctx.invoker.invoke(prompt, { model: 'claude-sonnet-4-6' });

    try {
      const start = result.output.indexOf('{');
      const end = result.output.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        const parsed = DuplicateResultSchema.parse(JSON.parse(result.output.slice(start, end + 1)));
        allDuplicates.push(...parsed.duplicates);
      }
    } catch {
      ctx.logger.warn('storytelling: detect_duplicates batch parse failed', {
        storyId,
        batchIndex: i,
      });
    }
  }

  if (allDuplicates.length === 0) {
    return `Analyzed ${moments.length} moments across ${batches.length} batch(es). No duplicates found.`;
  }

  const lines = allDuplicates.map((d, i) => {
    const drift = d.isDrift ? ' [DRIFT]' : '';
    return `${i + 1}. ${d.confidence.toUpperCase()}${drift}: "${d.explanation}" — Recommend keeping ${d.canonicalId}. Differences: ${d.differences}`;
  });

  return `Found ${allDuplicates.length} potential duplicate(s) across ${moments.length} moments:\n\n${lines.join('\n')}\n\nUse merge_moments to resolve each pair. Pass keepId and discardId.`;
};
