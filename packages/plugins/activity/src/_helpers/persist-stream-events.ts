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

type PersistStreamEvents = (db: PrismaClient, threadId: string, events: InvokeStreamEvent[]) => Promise<void>;

const persistStreamEvents: PersistStreamEvents = async (db, threadId, events) => {
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
          ? { toolUseId: event.toolUseId ?? null, toolName: event.toolName ?? null, success: true, blocks: event.blocks }
          : { toolUseId: event.toolUseId ?? null, toolName: event.toolName ?? null, success: true },
      });
    }
  }

  if (records.length === 0) {
    return;
  }

  // Batch all writes in a single transaction to reduce round-trips
  await db.$transaction(records.map((data) => db.message.create({ data })));
};

export { persistStreamEvents };
