// Tests for invoke-sub-agent helper

import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
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
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }) as unknown as PluginContext;

describe('invokeSubAgent', () => {
  it('invokes the agent with the prompt and model', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do research', 'task-1', 'thread-1', 'claude-opus-4-20250514');

    expect(ctx.invoker.invoke).toHaveBeenCalledWith('Do research', { model: 'claude-opus-4-20250514', threadId: 'thread-1', onMessage: undefined });
  });

  it('invokes with undefined model when not specified', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    expect(ctx.invoker.invoke).toHaveBeenCalledWith('Do work', { model: undefined, threadId: 'thread-1', onMessage: undefined });
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

  it('records an agent run with completed status on exit code 0', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        threadId: 'thread-1',
        taskId: 'task-1',
        model: 'claude-sonnet-4-20250514',
        durationMs: 1500,
        status: 'completed',
        error: null,
      }),
    });
  });

  it('records an agent run with failed status on non-zero exit code', async () => {
    const ctx = createMockContext();
    (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: '',
      durationMs: 100,
      exitCode: 1,
      error: 'Process crashed',
    });

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'failed',
        error: 'Process crashed',
      }),
    });
  });

  it('uses explicit model when provided', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', 'claude-opus-4-20250514');

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        model: 'claude-opus-4-20250514',
      }),
    });
  });

  it('falls back to config model when model is undefined', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        model: 'claude-sonnet-4-20250514',
      }),
    });
  });

  it('returns the invoke result', async () => {
    const ctx = createMockContext();

    const result = await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    expect(result.output).toBe('Agent output here');
    expect(result.durationMs).toBe(1500);
    expect(result.exitCode).toBe(0);
  });

  it('records token usage metrics', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    const metricCreateMany = (ctx.db as unknown as { metric: { createMany: ReturnType<typeof vi.fn> } }).metric.createMany;
    expect(metricCreateMany).toHaveBeenCalledOnce();
  });

  it('includes input tokens and cost estimate in the agent run', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        costEstimate: expect.any(Number),
      }),
    });
  });

  it('passes onMessage callback to invoke', async () => {
    const ctx = createMockContext();
    const onMessage = vi.fn();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined, onMessage);

    expect(ctx.invoker.invoke).toHaveBeenCalledWith('Do work', { model: undefined, threadId: 'thread-1', onMessage });
  });

  it('handles undefined error by setting null', async () => {
    const ctx = createMockContext();
    (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: 'ok',
      durationMs: 100,
      exitCode: 0,
      error: undefined,
    });

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        error: null,
      }),
    });
  });
});
