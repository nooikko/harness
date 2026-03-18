import type { InvokeStreamEvent } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { persistStreamEvents } from '../persist-stream-events';

const makeDb = () => {
  const create = vi.fn().mockResolvedValue({});
  return {
    message: { create },
    $transaction: vi.fn().mockImplementation((promises: Promise<unknown>[]) => Promise.all(promises)),
  };
};

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
        // toolName is always written (null when the event has no toolName)
        metadata: { toolUseId: 'tu-2', toolName: null, success: true },
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

  it('includes blocks in tool_result metadata when tool_use_summary event carries blocks', async () => {
    const db = makeDb();
    const blocks = [{ type: 'email-list', data: { emails: ['alice@example.com'] } }];
    const event: InvokeStreamEvent = {
      type: 'tool_use_summary',
      content: 'Retrieved 1 email',
      toolUseId: 'tu-3',
      toolName: 'outlook__list_emails',
      blocks,
      timestamp: Date.now(),
    };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        role: 'assistant',
        kind: 'tool_result',
        source: 'outlook',
        content: 'Retrieved 1 email',
        metadata: {
          toolUseId: 'tu-3',
          toolName: 'outlook__list_emails',
          success: true,
          blocks,
        },
      },
    });
  });

  it('omits blocks from tool_result metadata when tool_use_summary event has no blocks', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = {
      type: 'tool_use_summary',
      content: 'Task completed',
      toolUseId: 'tu-4',
      toolName: 'cron__schedule_task',
      timestamp: Date.now(),
    };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    const calledData = db.message.create.mock.calls[0]![0].data as { metadata: Record<string, unknown> };
    expect(calledData.metadata).not.toHaveProperty('blocks');
    expect(calledData.metadata).toEqual({
      toolUseId: 'tu-4',
      toolName: 'cron__schedule_task',
      success: true,
    });
  });
});
