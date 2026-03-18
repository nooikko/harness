import type { PluginContext } from '@harness/plugin-contract';
import { z } from 'zod';

const SEMANTIC_IMPORTANCE = 8;

const SynthesisSchema = z.object({
  action: z.enum(['skip', 'create', 'update']),
  insight: z.string().optional(),
  supersedes: z.string().optional(),
});

// Extract the first JSON object from a response that may include prose or code fences.
type ExtractJson = (text: string) => string;
const extractJson: ExtractJson = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in response');
  }
  return text.slice(start, end + 1);
};

type SynthesizeUserInsight = (ctx: PluginContext, agentId: string, agentName: string, newFact: string) => Promise<void>;

export const synthesizeUserInsight: SynthesizeUserInsight = async (ctx, agentId, agentName, newFact) => {
  const existing = await ctx.db.agentMemory.findMany({
    where: { agentId, type: 'SEMANTIC' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // First SEMANTIC memory — write the fact directly, no synthesis needed
  if (existing.length === 0) {
    await ctx.db.agentMemory.create({
      data: {
        agentId,
        content: newFact,
        type: 'SEMANTIC',
        scope: 'AGENT',
        importance: SEMANTIC_IMPORTANCE,
      },
    });
    ctx.logger.info('Wrote first user insight', { agentId, fact: newFact });
    return;
  }

  // Synthesize with existing knowledge
  const existingText = existing.map((m) => `- [id:${m.id}] ${m.content}`).join('\n');

  let action: 'skip' | 'create' | 'update' = 'skip';
  let insight: string | undefined;
  let supersedes: string | undefined;

  try {
    const result = await ctx.invoker.invoke(
      `You are ${agentName}, analyzing a new fact about the user you serve.\n\nExisting knowledge about the user:\n${existingText}\n\nNew fact detected: "${newFact}"\n\nDecide:\n1. If this fact is already captured by an existing insight (even if phrased differently), return {"action": "skip"}\n2. If this is genuinely new information, synthesize it with what you already know into an actionable insight. Return {"action": "create", "insight": "<synthesized insight>"}\n3. If this updates or refines an existing insight, return {"action": "update", "insight": "<updated insight>", "supersedes": "<id of the old insight>"}\n\nThe insight should be concise (1-2 sentences) and actionable — not just the raw fact, but what it means for how you should interact with the user. Connect dots across multiple facts when possible.\n\nOutput ONLY valid JSON.`,
      { model: 'claude-haiku-4-5-20251001' },
    );
    const parsed = SynthesisSchema.parse(JSON.parse(extractJson(result.output)));
    action = parsed.action;
    insight = parsed.insight;
    supersedes = parsed.supersedes;
  } catch (err) {
    ctx.logger.warn('identity: user insight synthesis failed', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (action === 'skip') {
    ctx.logger.debug('User insight skipped (duplicate)', {
      agentId,
      fact: newFact,
    });
    return;
  }

  if (action === 'update' && supersedes) {
    // Update the old memory in-place to preserve ID references, then create the new one
    const supersededMemory = existing.find((m) => m.id === supersedes);
    if (supersededMemory) {
      await ctx.db.agentMemory.update({
        where: { id: supersedes },
        data: { content: insight ?? newFact },
      });
      ctx.logger.info('Updated user insight (superseded)', {
        agentId,
        supersedes,
        insight,
      });
      return;
    }
    // If superseded ID not found, fall through to create
  }

  // action === "create" or fallthrough from update with missing supersedes ID
  await ctx.db.agentMemory.create({
    data: {
      agentId,
      content: insight ?? newFact,
      type: 'SEMANTIC',
      scope: 'AGENT',
      importance: SEMANTIC_IMPORTANCE,
    },
  });
  ctx.logger.info('Wrote new user insight', { agentId, insight });
};
