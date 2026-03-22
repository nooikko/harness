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
        metadata: { durationMs: null },
      },
    });
  });

  it('persists tool_call events as kind:tool_call with plugin source', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = {
      type: 'tool_call',
      toolName: 'delegation__delegate',
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
          durationMs: null,
        },
      },
    });
  });

  it('persists tool_use_summary events as kind:tool_result without success field', async () => {
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
        metadata: { toolUseId: 'tu-2', toolName: null, durationMs: null },
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
          blocks,
          durationMs: null,
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
      durationMs: null,
    });
  });

  it('skips tool_call events with no toolName', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = { type: 'tool_call', timestamp: Date.now() };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    expect(db.message.create).not.toHaveBeenCalled();
  });

  it('skips tool_use_summary events with no content', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = { type: 'tool_use_summary', toolUseId: 'tu-5', timestamp: Date.now() };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    expect(db.message.create).not.toHaveBeenCalled();
  });

  it('omits blocks from metadata when blocks is an empty array', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = {
      type: 'tool_use_summary',
      content: 'Done',
      toolUseId: 'tu-6',
      toolName: 'time__current_time',
      blocks: [],
      timestamp: Date.now(),
    };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    const calledData = db.message.create.mock.calls[0]![0].data as { metadata: Record<string, unknown> };
    expect(calledData.metadata).not.toHaveProperty('blocks');
  });

  it('falls back to null for missing toolUseId and toolInput on tool_call', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = {
      type: 'tool_call',
      toolName: 'Read',
      timestamp: Date.now(),
    };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    const calledData = db.message.create.mock.calls[0]![0].data as { metadata: Record<string, unknown> };
    expect(calledData.metadata).toEqual({
      toolName: 'Read',
      toolUseId: null,
      input: null,
      durationMs: null,
    });
  });

  it('falls back to null for missing toolUseId on tool_use_summary without blocks', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = {
      type: 'tool_use_summary',
      content: 'Completed',
      timestamp: Date.now(),
    };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    const calledData = db.message.create.mock.calls[0]![0].data as { metadata: Record<string, unknown> };
    expect(calledData.metadata).toEqual({
      toolUseId: null,
      toolName: null,
      durationMs: null,
    });
  });

  it('falls back to null for missing toolUseId and toolName on tool_use_summary with blocks', async () => {
    const db = makeDb();
    const blocks = [{ type: 'chart', data: { value: 42 } }];
    const event: InvokeStreamEvent = {
      type: 'tool_use_summary',
      content: 'Charted data',
      blocks,
      timestamp: Date.now(),
    };

    await persistStreamEvents(db as never, 'thread-1', [event]);

    const calledData = db.message.create.mock.calls[0]![0].data as { metadata: Record<string, unknown> };
    expect(calledData.metadata).toEqual({
      toolUseId: null,
      toolName: null,
      blocks,
      durationMs: null,
    });
  });

  it('computes durationMs as difference between consecutive persisted event timestamps', async () => {
    const db = makeDb();
    const events: InvokeStreamEvent[] = [
      { type: 'thinking', content: 'Let me think.', timestamp: 1000 },
      { type: 'tool_call', toolName: 'Read', timestamp: 1800 },
      { type: 'tool_use_summary', content: 'Done', toolUseId: 'tu-1', timestamp: 2500 },
    ];

    await persistStreamEvents(db as never, 'thread-1', events);

    expect(db.message.create).toHaveBeenCalledTimes(3);
    const calls = db.message.create.mock.calls;
    expect((calls[0]![0].data as { metadata: Record<string, unknown> }).metadata.durationMs).toBe(800);
    expect((calls[1]![0].data as { metadata: Record<string, unknown> }).metadata.durationMs).toBe(700);
    expect((calls[2]![0].data as { metadata: Record<string, unknown> }).metadata.durationMs).toBeNull();
  });

  it('excludes skipped events from duration computation (only persisted events counted)', async () => {
    const db = makeDb();
    const events: InvokeStreamEvent[] = [
      { type: 'thinking', content: 'Thinking...', timestamp: 1000 },
      { type: 'unknown_type', timestamp: 1500 }, // skipped — should not affect duration
      { type: 'tool_call', toolName: 'Read', timestamp: 2000 },
    ];

    await persistStreamEvents(db as never, 'thread-1', events);

    expect(db.message.create).toHaveBeenCalledTimes(2);
    const calls = db.message.create.mock.calls;
    // Duration from thinking (1000) to tool_call (2000), skipping the unknown_type
    expect((calls[0]![0].data as { metadata: Record<string, unknown> }).metadata.durationMs).toBe(1000);
    expect((calls[1]![0].data as { metadata: Record<string, unknown> }).metadata.durationMs).toBeNull();
  });

  it('propagates create errors to caller', async () => {
    const db = makeDb();
    db.message.create.mockRejectedValueOnce(new Error('write failed'));
    const events: InvokeStreamEvent[] = [{ type: 'thinking', content: 'hmm', timestamp: Date.now() }];

    await expect(persistStreamEvents(db as never, 'thread-1', events)).rejects.toThrow('write failed');
  });

  it('includes traceId in tool_call metadata when provided', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = {
      type: 'tool_call',
      toolName: 'Read',
      timestamp: Date.now(),
    };

    await persistStreamEvents(db as never, 'thread-1', [event], 'trace-123');

    const calledData = db.message.create.mock.calls[0]![0].data as { metadata: Record<string, unknown> };
    expect(calledData.metadata).toHaveProperty('traceId', 'trace-123');
  });

  it('includes traceId in tool_result metadata when provided', async () => {
    const db = makeDb();
    const event: InvokeStreamEvent = {
      type: 'tool_use_summary',
      content: 'Done',
      toolUseId: 'tu-1',
      timestamp: Date.now(),
    };

    await persistStreamEvents(db as never, 'thread-1', [event], 'trace-456');

    const calledData = db.message.create.mock.calls[0]![0].data as { metadata: Record<string, unknown> };
    expect(calledData.metadata).toHaveProperty('traceId', 'trace-456');
  });
});
