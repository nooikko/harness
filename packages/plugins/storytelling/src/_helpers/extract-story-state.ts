import type { PluginContext } from '@harness/plugin-contract';
import { applyExtraction } from './apply-extraction';
import { buildExtractionPrompt } from './build-extraction-prompt';
import { EXTRACTION_MODEL, EXTRACTION_TIMEOUT, loadExtractionSystemPrompt } from './extraction-config';
import { parseExtractionResult } from './parse-extraction-result';

type ExtractStoryState = (ctx: PluginContext, storyId: string, threadId: string, assistantOutput: string) => Promise<void>;

export const extractStoryState: ExtractStoryState = async (ctx, storyId, threadId, assistantOutput) => {
  // 1. Query existing characters
  const characters = await ctx.db.storyCharacter.findMany({
    where: { storyId, status: 'active' },
    select: { id: true, name: true },
    take: 50,
  });

  // 2. Query existing locations
  const locations = await ctx.db.storyLocation.findMany({
    where: { storyId },
    select: { id: true, name: true, parent: { select: { name: true } } },
    take: 100,
  });

  const locationRefs = locations.map((l: { id: string; name: string; parent: { name: string } | null }) => ({
    id: l.id,
    name: l.name,
    ...(l.parent ? { parentName: l.parent.name } : {}),
  }));

  // 3. Query story time and current day
  const story = await ctx.db.story.findUnique({
    where: { id: storyId },
    select: { storyTime: true, currentDay: true },
  });

  // 4. Query recent user messages (take 2, most recent first)
  const recentMessages = await ctx.db.message.findMany({
    where: { threadId, role: 'user' },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: { content: true },
  });

  // 5. Build latest exchange (user messages in chronological order + assistant output)
  const userMessages = recentMessages
    .reverse()
    .map((m: { content: string }) => `[User]: ${m.content}`)
    .join('\n\n');
  const latestExchange = `${userMessages}\n\n[Assistant]: ${assistantOutput}`;

  // 6. Build extraction prompt
  const prompt = buildExtractionPrompt({
    characters,
    locations: locationRefs,
    storyTime: story?.storyTime ?? null,
    currentDay: story?.currentDay ?? null,
    latestExchange,
  });

  // 7. Call extraction model with Safe Space soul
  const systemPrompt = await loadExtractionSystemPrompt(ctx);
  const result = await ctx.invoker.invoke(prompt, {
    model: EXTRACTION_MODEL,
    maxTurns: 1,
    timeout: EXTRACTION_TIMEOUT,
    systemPrompt,
  });

  // 8. Check for invocation errors (e.g. content refusal)
  if (result.error) {
    ctx.logger.warn('storytelling: extraction sub-invocation failed', {
      storyId,
      threadId,
      error: result.error,
    });
    return;
  }

  // 9. Parse result
  const parsed = parseExtractionResult(result.output);
  if (!parsed) {
    ctx.logger.warn('storytelling: extraction result could not be parsed', {
      storyId,
      threadId,
      rawOutput: result.output.slice(0, 500),
    });
    return;
  }

  // 9. Apply extraction to DB
  await applyExtraction(parsed, ctx.db as never, storyId, ctx as never);
};
