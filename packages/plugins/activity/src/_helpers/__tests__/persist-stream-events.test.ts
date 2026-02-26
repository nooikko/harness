import type { InvokeStreamEvent } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { persistStreamEvents } from '../persist-stream-events';

const makeDb = () => ({
  message: { create: vi.fn().mockResolvedValue({}) },
});

describe('persistStreamEvents', () => {
  it('persists thinking events as kind:thinking', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = { type: 'thinking', content: 'Let me think.', timestamp: Date.now() };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        role: 'assistant',
        kind: 'thinking',
        source: 'builtin',
        content: 'Let me think.',
      },
    });
  });

  it('persists tool_call events as kind:tool_call with plugin source', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = {
      type: 'tool_call',
      toolName: 'delegation__delegate', // real tool server format: ${p.name}__${t.name}
      toolUseId: 'tu-1',
      toolInput: { task: 'do something' },
      timestamp: Date.now(),
    };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        role: 'assistant',
        kind: 'tool_call',
        source: 'delegation',
        content: 'delegation__delegate',
        metadata: {
          toolName: 'delegation__delegate',
          toolUseId: 'tu-1',
          input: { task: 'do something' },
        },
      },
    });
  });

  it('persists tool_use_summary events as kind:tool_result', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = {
      type: 'tool_use_summary',
      content: 'Listed 5 files',
      toolUseId: 'tu-2',
      timestamp: Date.now(),
    };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        role: 'assistant',
        kind: 'tool_result',
        source: 'builtin',
        content: 'Listed 5 files',
        metadata: { toolUseId: 'tu-2', success: true },
      },
    });
  });

  it('skips unknown event types', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = { type: 'unknown_type', timestamp: Date.now() };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    expect(db.message.create).not.toHaveBeenCalled();
  });

  it('skips thinking events with no content', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = { type: 'thinking', timestamp: Date.now() };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    expect(db.message.create).not.toHaveBeenCalled();
  });
});
