// Tests for invoke-sub-agent helper

import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@harness/plugin-contract', () => ({
  getModelCost: vi.fn().mockImplementation((_model: string, input: number, output: number) => {
    if (input === 0 && output === 0) {
      return 0;
    }
    return (input / 1_000_000) * 3 + (output / 1_000_000) * 15;
  }),
  isKnownModel: vi.fn().mockReturnValue(true),
}));

import { invokeSubAgent } from '../invoke-sub-agent';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () =>
  ({
    db: {
      message: {
        create: vi.fn().mockResolvedValue({}),
      },
      agentRun: {
        create: vi.fn().mockResolvedValue({ id: 'run-123' }),
      },
      metric: {
        createMany: vi.fn().mockResolvedValue({ count: 4 }),
      },
    },
    invoker: {
      invoke: vi.fn().mockResolvedValue({
        output: 'Agent output here',
        durationMs: 1500,
        exitCode: 0,
      }),
    },
    config: {
      claudeModel: 'claude-sonnet-4-20250514',
      claudeTimeout: 30000,
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }) as unknown as PluginContext;

describe('invokeSubAgent', () => {
  it('invokes the agent with the prompt and model', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do research', 'task-1', 'thread-1', 'claude-opus-4-20250514');

    expect(ctx.invoker.invoke).toHaveBeenCalledWith('Do research', {
      model: 'claude-opus-4-20250514',
      threadId: 'thread-1',
      timeout: expect.any(Number),
      onMessage: undefined,
      traceId: undefined,
      taskId: 'task-1',
    });
  });

  it('invokes with undefined model when not specified', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    expect(ctx.invoker.invoke).toHaveBeenCalledWith('Do work', {
      model: undefined,
      threadId: 'thread-1',
      timeout: expect.any(Number),
      onMessage: undefined,
      traceId: undefined,
      taskId: 'task-1',
    });
  });

  it('persists the assistant message in the task thread', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    const messageCreate = (ctx.db as unknown as { message: { create: ReturnType<typeof vi.fn> } }).message.create;
    expect(messageCreate).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        role: 'assistant',
        content: 'Agent output here',
      },
    });
  });

  it('does not persist empty output as assistant message', async () => {
    const ctx = createMockContext();
    (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: '',
      durationMs: 100,
      exitCode: 1,
      error: 'Process crashed',
    });

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    const messageCreate = (ctx.db as unknown as { message: { create: ReturnType<typeof vi.fn> } }).message.create;
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it('returns the invoke result', async () => {
    const ctx = createMockContext();

    const result = await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    expect(result.output).toBe('Agent output here');
    expect(result.durationMs).toBe(1500);
    expect(result.exitCode).toBe(0);
  });

  it('records token usage metrics with expected metric names', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    const metricCreateMany = (ctx.db as unknown as { metric: { createMany: ReturnType<typeof vi.fn> } }).metric.createMany;
    expect(metricCreateMany).toHaveBeenCalledOnce();
    const call = metricCreateMany.mock.calls[0]?.[0] as { data: Array<{ name: string }> };
    const names = call.data.map((m: { name: string }) => m.name);
    expect(names).toContain('token.input');
    expect(names).toContain('token.output');
    expect(names).toContain('token.total');
    expect(names).toContain('token.cost');
  });

  it('passes onMessage callback to invoke', async () => {
    const ctx = createMockContext();
    const onMessage = vi.fn();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined, onMessage);

    expect(ctx.invoker.invoke).toHaveBeenCalledWith('Do work', {
      model: undefined,
      threadId: 'thread-1',
      timeout: 30000,
      onMessage,
      traceId: undefined,
      taskId: 'task-1',
    });
  });

  it('passes traceId to invoke options', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined, undefined, 'trace-abc-123');

    expect(ctx.invoker.invoke).toHaveBeenCalledWith('Do work', {
      model: undefined,
      threadId: 'thread-1',
      timeout: 30000,
      onMessage: undefined,
      traceId: 'trace-abc-123',
      taskId: 'task-1',
    });
  });

  it('passes taskId through InvokeOptions', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    expect(ctx.invoker.invoke).toHaveBeenCalledWith('Do work', expect.objectContaining({ taskId: 'task-1' }));
  });
});
