// Persists pipeline activity records for delegation sub-agent invocations.
// Mirrors the activity plugin's persistence format so the UI can group and render
// thinking blocks, tool calls, and tool results inside pipeline run blocks.

import type { InvokeResult, InvokeStreamEvent, PluginContext } from '@harness/plugin-contract';

type MessageData = {
  threadId: string;
  role: string;
  kind: string;
  source: string;
  content: string;
  metadata?: object;
};

type ParsePluginSource = (toolName: string | undefined) => string;

const parsePluginSource: ParsePluginSource = (toolName) => {
  if (!toolName) {
    return 'builtin';
  }
  const match = /^(\w+?)__/.exec(toolName);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }
  return 'builtin';
};

type PersistDelegationActivity = (
  ctx: PluginContext,
  threadId: string,
  events: InvokeStreamEvent[],
  invokeResult: InvokeResult,
  traceId?: string,
) => Promise<void>;

const persistDelegationActivity: PersistDelegationActivity = async (ctx, threadId, events, invokeResult, traceId) => {
  // 1. Pipeline start status
  await ctx.db.message.create({
    data: {
      threadId,
      role: 'system',
      kind: 'status',
      content: 'Pipeline started',
      metadata: { event: 'pipeline_start', ...(traceId ? { traceId } : {}) },
    },
  });

  // 2. Stream events — same schema as activity plugin's persistStreamEvents
  const persistable: { event: InvokeStreamEvent; nextTimestamp: number | null }[] = [];
  for (const event of events) {
    const willPersist =
      (event.type === 'thinking' && !!event.content) ||
      (event.type === 'tool_call' && !!event.toolName) ||
      (event.type === 'tool_use_summary' && !!event.content);
    if (willPersist) {
      persistable.push({ event, nextTimestamp: null });
    }
  }
  for (let i = 0; i < persistable.length - 1; i++) {
    persistable[i]!.nextTimestamp = persistable[i + 1]!.event.timestamp;
  }

  const records: MessageData[] = [];

  for (const { event, nextTimestamp } of persistable) {
    const durationMs = nextTimestamp != null ? nextTimestamp - event.timestamp : null;

    if (event.type === 'thinking' && event.content) {
      records.push({
        threadId,
        role: 'assistant',
        kind: 'thinking',
        source: 'builtin',
        content: event.content,
        metadata: { durationMs, ...(traceId ? { traceId } : {}) },
      });
    } else if (event.type === 'tool_call' && event.toolName) {
      records.push({
        threadId,
        role: 'assistant',
        kind: 'tool_call',
        source: parsePluginSource(event.toolName),
        content: event.toolName,
        metadata: {
          toolName: event.toolName,
          toolUseId: event.toolUseId ?? null,
          input: event.toolInput ?? null,
          durationMs,
          ...(traceId ? { traceId } : {}),
        },
      });
    } else if (event.type === 'tool_use_summary' && event.content) {
      const hasBlocks = event.blocks && event.blocks.length > 0;
      records.push({
        threadId,
        role: 'assistant',
        kind: 'tool_result',
        source: event.toolName ? parsePluginSource(event.toolName) : 'builtin',
        content: event.content,
        metadata: {
          toolUseId: event.toolUseId ?? null,
          toolName: event.toolName ?? null,
          ...(hasBlocks ? { blocks: event.blocks } : {}),
          durationMs,
          ...(traceId ? { traceId } : {}),
        },
      });
    }
  }

  for (const data of records) {
    await ctx.db.message.create({ data });
  }

  // 3. Pipeline complete status
  await ctx.db.message.create({
    data: {
      threadId,
      role: 'system',
      kind: 'status',
      content: 'Pipeline complete',
      metadata: {
        event: 'pipeline_complete',
        durationMs: invokeResult.durationMs ?? null,
        inputTokens: invokeResult.inputTokens ?? null,
        outputTokens: invokeResult.outputTokens ?? null,
        ...(traceId ? { traceId } : {}),
      },
    },
  });
};

export { persistDelegationActivity };
