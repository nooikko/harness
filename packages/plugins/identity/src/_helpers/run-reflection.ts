import type { PluginContext } from '@harness/plugin-contract';
import { z } from 'zod';

const REFLECTION_IMPORTANCE = 8;

const InsightsSchema = z.object({
  insights: z.array(z.string().min(1)).min(1),
});

type EpisodicMemory = {
  id: string;
  content: string;
  importance: number;
  createdAt: Date;
};

type RunReflection = (ctx: PluginContext, agentId: string, agentName: string, memories: EpisodicMemory[]) => Promise<void>;

export const runReflection: RunReflection = async (ctx, agentId, agentName, memories) => {
  const sourceMemoryIds = memories.map((m) => m.id);

  const memoriesText = memories.map((m) => `- [${m.createdAt.toISOString().slice(0, 10)}] (importance: ${m.importance}/10) ${m.content}`).join('\n');

  let insights: string[] = [];
  try {
    const result = await ctx.invoker.invoke(
      `You are synthesizing memories for an AI agent named ${agentName}.\n\nThe following are ${memories.length} recent experiences that have accumulated:\n\n${memoriesText}\n\nBased on these experiences, identify 3-5 key insights, patterns, or lessons that ${agentName} should carry forward. Focus on insights that are actionable and meaningful for future interactions.\n\nOutput ONLY valid JSON: {"insights": ["insight 1", "insight 2", ...]}`,
      { model: 'claude-haiku-4-5-20251001' },
    );
    const start = result.output.indexOf('{');
    const end = result.output.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('No JSON object found in response');
    }
    const parsed = InsightsSchema.parse(JSON.parse(result.output.slice(start, end + 1)));
    insights = parsed.insights;
  } catch (err) {
    ctx.logger.warn('Reflection synthesis failed', { agentId, error: String(err) });
    return;
  }

  await ctx.db.agentMemory.createMany({
    data: insights.map((content) => ({
      agentId,
      content,
      type: 'REFLECTION' as const,
      importance: REFLECTION_IMPORTANCE,
      sourceMemoryIds,
    })),
  });

  ctx.logger.info('Reflection complete', {
    agentId,
    insights: insights.length,
    sourcedFrom: memories.length,
  });
};
