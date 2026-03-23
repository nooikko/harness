import type { PluginContext } from '@harness/plugin-contract';
import { z } from 'zod';
import { checkReflectionTrigger } from './check-reflection-trigger';
import { classifyMemoryScope } from './classify-memory-scope';
import { detectUserFacts } from './detect-user-facts';
import { runReflection } from './run-reflection';
import { synthesizeUserInsight } from './synthesize-user-insight';

const DEFAULT_IMPORTANCE_THRESHOLD = 6;
const SNIPPET_HEAD = 250;
const SNIPPET_TAIL = 250;
const SUMMARY_MAX_CHARS = 1500;

const ImportanceSchema = z.object({
  importance: z.number().int().min(1).max(10),
  userFact: z.string().nullish(),
});

const SummarySchema = z.object({
  summary: z.string().min(1),
  scope: z.enum(['AGENT', 'PROJECT', 'THREAD']).optional(),
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

type ScoreAndWriteMemoryOptions = {
  reflectionEnabled?: boolean;
  projectId?: string | null;
  importanceThreshold?: number;
  reflectionThreshold?: number;
};

type ScoreAndWriteMemory = (
  ctx: PluginContext,
  agentId: string,
  agentName: string,
  threadId: string,
  output: string,
  options?: ScoreAndWriteMemoryOptions,
) => Promise<void>;

export const scoreAndWriteMemory: ScoreAndWriteMemory = async (ctx, agentId, agentName, threadId, output, options) => {
  const reflectionEnabled = options?.reflectionEnabled ?? false;
  const projectId = options?.projectId;
  const importanceThreshold = options?.importanceThreshold ?? DEFAULT_IMPORTANCE_THRESHOLD;
  const reflectionThreshold = options?.reflectionThreshold;
  if (!output || output.trim().length === 0) {
    return;
  }

  const scoringSnippet = buildScoringSnippet(output);
  const summarySnippet = output.slice(0, SUMMARY_MAX_CHARS);

  let importance = 0;
  let userFact: string | null = null;
  try {
    const result = await ctx.invoker.invoke(
      `Rate the importance of this AI response for long-term memory on a scale 1-10.\n1 = mundane exchange (greeting, simple acknowledgment)\n10 = significant event, insight, or decision that shapes understanding\n\nAlso: if the conversation reveals a fact about the USER (not about you the AI, not about third parties) — something about their preferences, habits, conditions, personality, or life — include it as a short phrase in "userFact".\nExamples: "has ADD", "prefers short responses", "doesn't like toffee", "works in data engineering"\n\nOutput ONLY valid JSON: {"importance": <number 1-10>, "userFact": "<optional short phrase>"}\n\nResponse:\n${scoringSnippet}`,
      { model: 'claude-haiku-4-5-20251001' },
    );
    const parsed = ImportanceSchema.parse(JSON.parse(extractJson(result.output)));
    importance = parsed.importance;
    userFact = detectUserFacts(parsed);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    ctx.logger.warn('identity: importance scoring failed', {
      error: e.message,
      stack: e.stack,
    });
    return;
  }

  // User insight synthesis — fire-and-forget, independent of importance threshold
  if (userFact) {
    void synthesizeUserInsight(ctx, agentId, agentName, userFact).catch((err) => {
      ctx.logger.warn('identity: user insight synthesis failed', {
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  if (importance < importanceThreshold) {
    return;
  }

  // Summarize into a compact memory + classify scope (piggybacked on same LLM call)
  let content = '';
  let haikuScope: string | null = null;
  try {
    const scopeContext = projectId ? ' within a specific project' : '';
    const summary = await ctx.invoker.invoke(
      `Summarize this AI response as a single memory entry (1-2 sentences, past tense, third person referring to the agent).\nAlso classify the scope of this memory:\n- AGENT: personality traits, general preferences, cross-project knowledge\n- PROJECT: project-specific facts, decisions, technical details${scopeContext}\n- THREAD: session-specific context unlikely to matter in other conversations\nOutput ONLY valid JSON: {"summary": "<1-2 sentence summary>", "scope": "AGENT|PROJECT|THREAD"}\n\n${summarySnippet}`,
      { model: 'claude-haiku-4-5-20251001' },
    );
    const parsed = SummarySchema.parse(JSON.parse(extractJson(summary.output)));
    content = parsed.summary;
    haikuScope = parsed.scope ?? null;
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    ctx.logger.warn('identity: memory summarization failed, using fallback snippet', {
      error: e.message,
      stack: e.stack,
    });
    content = scoringSnippet.slice(0, 200);
  }

  const scope = classifyMemoryScope({
    projectId,
    threadId,
    haikuScope,
  });

  await ctx.db.agentMemory.create({
    data: {
      agentId,
      content,
      type: 'EPISODIC',
      scope,
      importance,
      threadId,
      ...(projectId ? { projectId } : {}),
    },
  });

  ctx.logger.debug('Wrote episodic memory', {
    agentId,
    threadId,
    importance,
    scope,
  });

  // Check if reflection should be triggered — fire-and-forget
  if (reflectionEnabled) {
    void (async () => {
      const trigger = await checkReflectionTrigger(ctx.db, agentId, projectId, reflectionThreshold, threadId);
      if (trigger.shouldReflect) {
        await runReflection(ctx, agentId, agentName, trigger.memories, projectId);
      }
    })().catch((err) => {
      ctx.logger.warn(`identity: reflection trigger failed [agent=${agentId}]: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
};
