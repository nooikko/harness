import type { PrismaClient } from '@harness/database';
import type { InvokeStreamEvent } from '@harness/plugin-contract';
import { parsePluginSource } from './parse-plugin-source';

type PersistStreamEvents = (db: PrismaClient, threadId: string, events: InvokeStreamEvent[]) => Promise<void>;

const persistStreamEvents: PersistStreamEvents = async (db, threadId, events) => {
  for (const event of events) {
    if (event.type === 'thinking' && event.content) {
      await db.message.create({
        data: { threadId, role: 'assistant', kind: 'thinking', source: 'builtin', content: event.content },
      });
    } else if (event.type === 'tool_call' && event.toolName) {
      await db.message.create({
        data: {
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
        },
      });
    } else if (event.type === 'tool_use_summary' && event.content) {
      await db.message.create({
        data: {
          threadId,
          role: 'assistant',
          kind: 'tool_result',
          source: 'builtin',
          content: event.content,
          metadata: { toolUseId: event.toolUseId ?? null, success: true },
        },
      });
    }
  }
};

export { persistStreamEvents };
