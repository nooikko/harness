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
  const records: MessageData[] = [];

  for (const event of events) {
    if (event.type === 'thinking' && event.content) {
      records.push({ threadId, role: 'assistant', kind: 'thinking', source: 'builtin', content: event.content });
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
          ? { toolUseId: event.toolUseId ?? null, toolName: event.toolName ?? null, blocks: event.blocks, ...(traceId ? { traceId } : {}) }
          : { toolUseId: event.toolUseId ?? null, toolName: event.toolName ?? null, ...(traceId ? { traceId } : {}) },
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
