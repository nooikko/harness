import type { PluginContext } from '@harness/plugin-contract';
import { z } from 'zod';
import { checkReflectionTrigger } from './check-reflection-trigger';
import { runReflection } from './run-reflection';

const IMPORTANCE_THRESHOLD = 6;
const SNIPPET_HEAD = 250;
const SNIPPET_TAIL = 250;
const SUMMARY_MAX_CHARS = 1500;

const ImportanceSchema = z.object({
  importance: z.number().int().min(1).max(10),
});

const SummarySchema = z.object({
  summary: z.string().min(1),
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

// Capture start + end so conclusions/summaries at the tail aren't missed.
// If the output fits entirely within head+tail, use it as-is.
type BuildScoringSnippet = (output: string) => string;
const buildScoringSnippet: BuildScoringSnippet = (output) => {
  if (output.length <= SNIPPET_HEAD + SNIPPET_TAIL) {
    return output;
  }
  return `${output.slice(0, SNIPPET_HEAD)}\n\n[...]\n\n${output.slice(-SNIPPET_TAIL)}`;
};

type ScoreAndWriteMemory = (
  ctx: PluginContext,
  agentId: string,
  agentName: string,
  threadId: string,
  output: string,
  reflectionEnabled?: boolean,
) => Promise<void>;

export const scoreAndWriteMemory: ScoreAndWriteMemory = async (ctx, agentId, agentName, threadId, output, reflectionEnabled = true) => {
  if (!output || output.trim().length === 0) {
    return;
  }

  const scoringSnippet = buildScoringSnippet(output);
  const summarySnippet = output.slice(0, SUMMARY_MAX_CHARS);

  let importance = 0;
  try {
    const result = await ctx.invoker.invoke(
      `Rate the importance of this AI response for long-term memory on a scale 1-10.\n1 = mundane exchange (greeting, simple acknowledgment)\n10 = significant event, insight, or decision that shapes understanding\nOutput ONLY valid JSON: {"importance": <number 1-10>}\n\nResponse:\n${scoringSnippet}`,
      { model: 'claude-haiku-4-5-20251001' },
    );
    const parsed = ImportanceSchema.parse(JSON.parse(extractJson(result.output)));
    importance = parsed.importance;
  } catch {
    return; // Don't fail the pipeline on importance scoring errors
  }

  if (importance < IMPORTANCE_THRESHOLD) {
    return;
  }

  // Summarize into a compact memory
  let content = '';
  try {
    const summary = await ctx.invoker.invoke(
      `Summarize this AI response as a single memory entry (1-2 sentences, past tense, third person referring to the agent).\nOutput ONLY valid JSON: {"summary": "<1-2 sentence summary>"}\n\n${summarySnippet}`,
      { model: 'claude-haiku-4-5-20251001' },
    );
    const parsed = SummarySchema.parse(JSON.parse(extractJson(summary.output)));
    content = parsed.summary;
  } catch {
    content = scoringSnippet.slice(0, 200);
  }

  await ctx.db.agentMemory.create({
    data: {
      agentId,
      content,
      type: 'EPISODIC',
      importance,
      threadId,
    },
  });

  ctx.logger.debug('Wrote episodic memory', { agentId, threadId, importance });

  // Check if reflection should be triggered — fire-and-forget
  if (reflectionEnabled) {
    void (async () => {
      const trigger = await checkReflectionTrigger(ctx.db, agentId);
      if (trigger.shouldReflect) {
        await runReflection(ctx, agentId, agentName, trigger.memories);
      }
    })();
  }
};
