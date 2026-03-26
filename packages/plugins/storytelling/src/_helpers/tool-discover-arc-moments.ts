import type { PluginContext } from '@harness/plugin-contract';
import { z } from 'zod';
import { buildArcDiscoveryPrompt } from './build-arc-discovery-prompt';
import { EXTRACTION_MODEL, loadExtractionSystemPrompt } from './extraction-config';

const MAX_CANDIDATES_PER_BATCH = 75;

const DiscoveryResultSchema = z.object({
  related: z.array(
    z.object({
      momentId: z.string(),
      confidence: z.enum(['high', 'medium', 'low']),
      explanation: z.string(),
    }),
  ),
});

type ReportProgress = (message: string, detail?: { current?: number; total?: number }) => void;

type HandleDiscoverArcMoments = (
  ctx: PluginContext,
  storyId: string,
  input: { arcId: string; guidance?: string; deepScan?: boolean },
  reportProgress?: ReportProgress,
) => Promise<string>;

export const handleDiscoverArcMoments: HandleDiscoverArcMoments = async (ctx, storyId, input, reportProgress) => {
  if (!input.arcId?.trim()) {
    return 'Error: arcId is required.';
  }

  // Load the arc with its seed moments
  const arc = await ctx.db.storyArc.findFirst({
    where: { id: input.arcId, storyId },
    select: {
      id: true,
      name: true,
      description: true,
      annotation: true,
      moments: {
        include: {
          moment: {
            select: {
              id: true,
              summary: true,
              storyTime: true,
              characters: { select: { characterName: true } },
            },
          },
        },
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!arc) {
    return `Error: arc "${input.arcId}" not found in this story.`;
  }

  const seedMomentIds = new Set(arc.moments.map((m: { moment: { id: string } }) => m.moment.id));

  const seedMoments = arc.moments.map((m: { moment: { summary: string; storyTime: string | null; characters: { characterName: string }[] } }) => ({
    summary: m.moment.summary,
    storyTime: m.moment.storyTime,
    characterNames: m.moment.characters.map((c: { characterName: string }) => c.characterName),
  }));

  if (seedMoments.length === 0) {
    return `Arc "${arc.name}" has no seed moments. Add some moments to the arc first, then run discovery.`;
  }

  // Phase 1 (fast): Search extracted moments
  const allMoments = await ctx.db.storyMoment.findMany({
    where: { storyId, deletedAt: null },
    select: {
      id: true,
      summary: true,
      storyTime: true,
      characters: { select: { characterName: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  // Filter out moments already in this arc
  const candidates = allMoments
    .filter((m: { id: string }) => !seedMomentIds.has(m.id))
    .map((m: { id: string; summary: string; storyTime: string | null; characters: { characterName: string }[] }) => ({
      id: m.id,
      summary: m.summary,
      storyTime: m.storyTime,
      characterNames: m.characters.map((c: { characterName: string }) => c.characterName),
    }));

  if (candidates.length === 0) {
    return 'No candidate moments to search (all moments are already in this arc or the story has no other moments).';
  }

  // Paginate candidates
  const batches: (typeof candidates)[] = [];
  for (let i = 0; i < candidates.length; i += MAX_CANDIDATES_PER_BATCH) {
    batches.push(candidates.slice(i, i + MAX_CANDIDATES_PER_BATCH));
  }

  const allRelated: z.infer<typeof DiscoveryResultSchema>['related'] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    reportProgress?.(`Searching batch ${i + 1}/${batches.length}`, { current: i + 1, total: batches.length });
    const prompt = buildArcDiscoveryPrompt({
      arcName: arc.name,
      arcDescription: arc.description,
      arcAnnotation: arc.annotation,
      seedMoments,
      candidates: batch,
      guidance: input.guidance,
    });

    const result = await ctx.invoker.invoke(prompt, { model: EXTRACTION_MODEL, systemPrompt: await loadExtractionSystemPrompt(ctx) });

    try {
      const start = result.output.indexOf('{');
      const end = result.output.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        const parsed = DiscoveryResultSchema.parse(JSON.parse(result.output.slice(start, end + 1)));
        allRelated.push(...parsed.related);
      }
    } catch {
      ctx.logger.warn('storytelling: discover_arc_moments batch parse failed', {
        storyId,
        arcId: input.arcId,
        batchIndex: i,
      });
    }
  }

  if (allRelated.length === 0) {
    return `Searched ${candidates.length} candidate moments for arc "${arc.name}". No related moments found.`;
  }

  const lines = allRelated.map((r, i) => `${i + 1}. [${r.confidence.toUpperCase()}] ${r.explanation} (moment: ${r.momentId})`);

  const deepNote =
    input.deepScan === false
      ? ''
      : '\n\nTo search raw transcripts for moments not yet extracted, run again with deepScan: true (takes 20-45 min per transcript).';

  return `Found ${allRelated.length} related moment(s) for arc "${arc.name}":\n\n${lines.join('\n')}${deepNote}\n\nUse annotate_moment to link confirmed moments to this arc.`;
};
