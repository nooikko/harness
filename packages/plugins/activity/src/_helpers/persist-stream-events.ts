import type { PrismaClient } from '@harness/database';
import type { InvokeStreamEvent } from '@harness/plugin-contract';
import { parsePluginSource } from './parse-plugin-source';

type MessageData = {
  threadId: string;
  role: string;
  kind: string;
  source: string;
  content: string;
  metadata?: object;
};

type PersistStreamEvents = (db: PrismaClient, threadId: string, events: InvokeStreamEvent[], traceId?: string) => Promise<void>;

const persistStreamEvents: PersistStreamEvents = async (db, threadId, events, traceId) => {
  // Pre-compute durations: index the filterable events only (those that will produce records)
  // We compute duration between consecutive persisted events, not skipped ones.
  // First pass: collect only the events we will persist, with their original index for timestamp lookup.
  type IndexedEvent = { event: InvokeStreamEvent; nextTimestamp: number | null };
  const persistableEvents: IndexedEvent[] = [];
  for (const event of events) {
    const willPersist =
      (event.type === 'thinking' && !!event.content) ||
      (event.type === 'tool_call' && !!event.toolName) ||
      (event.type === 'tool_use_summary' && !!event.content) ||
      (event.type === 'tool_progress' && !!event.content);
    if (willPersist) {
      persistableEvents.push({ event, nextTimestamp: null });
    }
  }
  // Deduplicate tool_progress: keep only the last event per toolName.
  // Progress events are status lines (like the live view), not a log.
  const lastProgressByTool = new Map<string, number>();
  for (let i = 0; i < persistableEvents.length; i++) {
    const pe = persistableEvents[i]!;
    if (pe.event.type === 'tool_progress' && pe.event.toolName) {
      lastProgressByTool.set(pe.event.toolName, i);
    }
  }
  const deduped = persistableEvents.filter((pe, i) => {
    if (pe.event.type !== 'tool_progress' || !pe.event.toolName) {
      return true;
    }
    return lastProgressByTool.get(pe.event.toolName) === i;
  });

  // Fill nextTimestamp from each persisted event's successor
  for (let i = 0; i < deduped.length - 1; i++) {
    deduped[i]!.nextTimestamp = deduped[i + 1]!.event.timestamp;
  }

  const records: MessageData[] = [];

  for (const { event, nextTimestamp } of deduped) {
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
    } else if (event.type === 'tool_progress' && event.content) {
      const progressEvent = event as InvokeStreamEvent & { current?: number; total?: number; traceId?: string };
      records.push({
        threadId,
        role: 'system',
        kind: 'tool_progress',
        source: event.toolName ? parsePluginSource(event.toolName) : 'builtin',
        content: event.content,
        metadata: {
          toolName: event.toolName ?? null,
          ...(progressEvent.current !== undefined ? { current: progressEvent.current } : {}),
          ...(progressEvent.total !== undefined ? { total: progressEvent.total } : {}),
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
        metadata: hasBlocks
          ? {
              toolUseId: event.toolUseId ?? null,
              toolName: event.toolName ?? null,
              blocks: event.blocks,
              durationMs,
              ...(traceId ? { traceId } : {}),
            }
          : { toolUseId: event.toolUseId ?? null, toolName: event.toolName ?? null, durationMs, ...(traceId ? { traceId } : {}) },
      });
    }
  }

  if (records.length === 0) {
    return;
  }

  for (const data of records) {
    await db.message.create({ data });
  }
};

export { persistStreamEvents };
