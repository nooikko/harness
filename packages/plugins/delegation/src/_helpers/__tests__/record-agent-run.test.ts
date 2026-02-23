// Tests for record-agent-run helper

import type { InvokeResult, PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { recordAgentRun } from '../record-agent-run';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () =>
  ({
    db: {
      agentRun: {
        create: vi.fn().mockResolvedValue({ id: 'run-abc-123' }),
      },
    },
    config: {
      claudeModel: 'claude-sonnet-4-20250514',
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }) as unknown as PluginContext;

type CreateInvokeResult = (overrides?: Partial<InvokeResult>) => InvokeResult;

const createInvokeResult: CreateInvokeResult = (overrides = {}) => ({
  output: 'Agent completed the work successfully',
  durationMs: 2500,
  exitCode: 0,
  ...overrides,
});

describe('recordAgentRun', () => {
  it('creates an agent run record', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: 'claude-opus-4-20250514',
      invokeResult: createInvokeResult(),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledTimes(1);
  });

  it('links the agent run to the task', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-42',
      threadId: 'thread-1',
      model: undefined,
      invokeResult: createInvokeResult(),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: 'task-42',
      }),
    });
  });

  it('links the agent run to the thread', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-99',
      model: undefined,
      invokeResult: createInvokeResult(),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        threadId: 'thread-99',
      }),
    });
  });

  it('uses the explicit model when provided', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: 'claude-opus-4-20250514',
      invokeResult: createInvokeResult(),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        model: 'claude-opus-4-20250514',
      }),
    });
  });

  it('falls back to config model when model is undefined', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      invokeResult: createInvokeResult(),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        model: 'claude-sonnet-4-20250514',
      }),
    });
  });

  it('estimates output tokens from the response text', async () => {
    const ctx = createMockContext();
    // 40 characters / 4 chars per token = 10 tokens
    const output = 'A'.repeat(40);

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      invokeResult: createInvokeResult({ output }),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outputTokens: 10,
      }),
    });
  });

  it('rounds up token estimates', async () => {
    const ctx = createMockContext();
    // 5 characters / 4 = 1.25, rounds up to 2
    const output = 'ABCDE';

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      invokeResult: createInvokeResult({ output }),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outputTokens: 2,
      }),
    });
  });

  it('estimates 0 tokens for empty output', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      invokeResult: createInvokeResult({ output: '' }),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outputTokens: 0,
      }),
    });
  });

  it('records durationMs from the invoke result', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      invokeResult: createInvokeResult({ durationMs: 5000 }),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        durationMs: 5000,
      }),
    });
  });

  it('sets status to completed on exit code 0', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      invokeResult: createInvokeResult({ exitCode: 0 }),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'completed',
      }),
    });
  });

  it('sets status to failed on non-zero exit code', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      invokeResult: createInvokeResult({ exitCode: 1, error: 'Process crashed' }),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'failed',
        error: 'Process crashed',
      }),
    });
  });

  it('sets error to null when no error in invoke result', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      invokeResult: createInvokeResult({ error: undefined }),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        error: null,
      }),
    });
  });

  it('sets completedAt as a Date instance', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      invokeResult: createInvokeResult(),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    const createCall = agentRunCreate.mock.calls[0]?.[0] as {
      data: { completedAt: unknown };
    };
    expect(createCall.data.completedAt).toBeInstanceOf(Date);
  });

  it('returns the created agent run ID', async () => {
    const ctx = createMockContext();

    const result = await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      invokeResult: createInvokeResult(),
    });

    expect(result.agentRunId).toBe('run-abc-123');
  });
});
