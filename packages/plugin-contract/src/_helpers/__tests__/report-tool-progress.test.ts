import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginContext, PluginToolMeta } from '../../index';
import { createToolProgressReporter } from '../report-tool-progress';

type MakeMockCtx = () => PluginContext;

const makeMockCtx: MakeMockCtx = () =>
  ({
    broadcast: vi.fn().mockResolvedValue(undefined),
  }) as unknown as PluginContext;

type MakeMeta = (overrides?: Partial<PluginToolMeta>) => PluginToolMeta;

const makeMeta: MakeMeta = (overrides = {}) => ({
  threadId: 'thread-1',
  traceId: 'trace-1',
  ...overrides,
});

describe('createToolProgressReporter', () => {
  let ctx: PluginContext;
  let meta: PluginToolMeta;

  beforeEach(() => {
    ctx = makeMockCtx();
    meta = makeMeta();
    vi.useFakeTimers();
  });

  it('returns a reportProgress function', () => {
    const { reportProgress } = createToolProgressReporter(ctx, meta, 'my_tool');
    expect(typeof reportProgress).toBe('function');
  });

  it('broadcasts a pipeline:stream event with tool_progress type', () => {
    const { reportProgress } = createToolProgressReporter(ctx, meta, 'my_tool');
    reportProgress('Processing chunk 1/3');

    expect(ctx.broadcast).toHaveBeenCalledWith('pipeline:stream', {
      threadId: 'thread-1',
      event: expect.objectContaining({
        type: 'tool_progress',
        toolName: 'my_tool',
        content: 'Processing chunk 1/3',
        timestamp: expect.any(Number),
      }),
    });
  });

  it('includes current/total when provided', () => {
    const { reportProgress } = createToolProgressReporter(ctx, meta, 'my_tool');
    reportProgress('Processing chunk', { current: 3, total: 12 });

    expect(ctx.broadcast).toHaveBeenCalledWith(
      'pipeline:stream',
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'tool_progress',
          content: 'Processing chunk',
          current: 3,
          total: 12,
        }),
      }),
    );
  });

  it('includes traceId from meta when present', () => {
    const { reportProgress } = createToolProgressReporter(ctx, meta, 'my_tool');
    reportProgress('Working');

    expect(ctx.broadcast).toHaveBeenCalledWith(
      'pipeline:stream',
      expect.objectContaining({
        event: expect.objectContaining({
          traceId: 'trace-1',
        }),
      }),
    );
  });

  it('omits traceId when meta has no traceId', () => {
    const metaNoTrace = makeMeta({ traceId: undefined });
    const { reportProgress } = createToolProgressReporter(ctx, metaNoTrace, 'my_tool');
    reportProgress('Working');

    const call = (ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const event = (call[1] as { event: Record<string, unknown> }).event;
    expect(event).not.toHaveProperty('traceId');
  });

  it('debounces calls within 500ms for the same tool', () => {
    const { reportProgress } = createToolProgressReporter(ctx, meta, 'my_tool');
    reportProgress('Chunk 1/3');
    vi.advanceTimersByTime(100);
    reportProgress('Chunk 2/3');
    vi.advanceTimersByTime(100);
    reportProgress('Chunk 3/3');

    // Only the first call should go through — the rest are debounced
    expect(ctx.broadcast).toHaveBeenCalledTimes(1);
    expect(ctx.broadcast).toHaveBeenCalledWith(
      'pipeline:stream',
      expect.objectContaining({
        event: expect.objectContaining({ content: 'Chunk 1/3' }),
      }),
    );
  });

  it('allows calls after debounce window expires', () => {
    const { reportProgress } = createToolProgressReporter(ctx, meta, 'my_tool');
    reportProgress('Chunk 1/3');
    vi.advanceTimersByTime(501);
    reportProgress('Chunk 2/3');

    expect(ctx.broadcast).toHaveBeenCalledTimes(2);
  });

  it('captures events in the returned events array', () => {
    const { reportProgress, events } = createToolProgressReporter(ctx, meta, 'my_tool');
    reportProgress('Chunk 1/3');
    vi.advanceTimersByTime(501);
    reportProgress('Chunk 2/3');

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(
      expect.objectContaining({
        type: 'tool_progress',
        toolName: 'my_tool',
        content: 'Chunk 1/3',
      }),
    );
    expect(events[1]).toEqual(
      expect.objectContaining({
        type: 'tool_progress',
        toolName: 'my_tool',
        content: 'Chunk 2/3',
      }),
    );
  });

  it('captures events even when debounced (events array gets all, broadcast is throttled)', () => {
    const { reportProgress, events } = createToolProgressReporter(ctx, meta, 'my_tool');
    reportProgress('Chunk 1/3');
    reportProgress('Chunk 2/3');
    reportProgress('Chunk 3/3');

    // Broadcast is debounced but events array captures all
    expect(ctx.broadcast).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(3);
  });

  it('is fire-and-forget — does not throw on broadcast error', () => {
    (ctx.broadcast as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('WebSocket down'));
    const { reportProgress } = createToolProgressReporter(ctx, meta, 'my_tool');

    expect(() => reportProgress('Working')).not.toThrow();
  });
});
