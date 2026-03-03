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
      metric: {
        createMany: vi.fn().mockResolvedValue({ count: 4 }),
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
  inputTokens: 100,
  outputTokens: 50,
  ...overrides,
});

describe('recordAgentRun', () => {
  it('creates an agent run record', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: 'claude-opus-4-20250514',
      prompt: 'Do the thing',
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
      prompt: 'Do the thing',
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
      prompt: 'Do the thing',
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
      prompt: 'Do the thing',
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
      prompt: 'Do the thing',
      invokeResult: createInvokeResult(),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        model: 'claude-sonnet-4-20250514',
      }),
    });
  });

  it('uses real outputTokens from the invoke result', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      prompt: 'Do the thing',
      invokeResult: createInvokeResult({ outputTokens: 200 }),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outputTokens: 200,
      }),
    });
  });

  it('uses real inputTokens from the invoke result', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      prompt: 'Do the thing',
      invokeResult: createInvokeResult({ inputTokens: 500 }),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inputTokens: 500,
      }),
    });
  });

  it('includes costEstimate in the agent run record', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      prompt: 'Do the thing',
      invokeResult: createInvokeResult(),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        costEstimate: expect.any(Number),
      }),
    });
  });

  it('falls back to 0 tokens when invokeResult has no token fields', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      prompt: 'Do the thing',
      invokeResult: createInvokeResult({ inputTokens: undefined, outputTokens: undefined }),
    });

    const agentRunCreate = (ctx.db as unknown as { agentRun: { create: ReturnType<typeof vi.fn> } }).agentRun.create;
    expect(agentRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inputTokens: 0,
        outputTokens: 0,
        costEstimate: 0,
      }),
    });
  });

  it('records durationMs from the invoke result', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      prompt: 'Do the thing',
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
      prompt: 'Do the thing',
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
      prompt: 'Do the thing',
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
      prompt: 'Do the thing',
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
      prompt: 'Do the thing',
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
      prompt: 'Do the thing',
      invokeResult: createInvokeResult(),
    });

    expect(result.agentRunId).toBe('run-abc-123');
  });

  it('returns token counts and cost estimate', async () => {
    const ctx = createMockContext();

    const result = await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      prompt: 'Do the thing',
      invokeResult: createInvokeResult({ inputTokens: 1000, outputTokens: 500 }),
    });

    expect(result.inputTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
    expect(result.costEstimate).toBeGreaterThan(0);
  });

  it('records usage metrics for dashboard aggregation', async () => {
    const ctx = createMockContext();

    await recordAgentRun(ctx, {
      taskId: 'task-1',
      threadId: 'thread-1',
      model: undefined,
      prompt: 'Do the thing',
      invokeResult: createInvokeResult(),
    });

    const metricCreateMany = (ctx.db as unknown as { metric: { createMany: ReturnType<typeof vi.fn> } }).metric.createMany;
    expect(metricCreateMany).toHaveBeenCalledOnce();
    const call = metricCreateMany.mock.calls[0]?.[0] as { data: Array<{ name: string }> };
    expect(call.data).toHaveLength(4);

    const names = call.data.map((m: { name: string }) => m.name);
    expect(names).toContain('token.input');
    expect(names).toContain('token.output');
    expect(names).toContain('token.total');
    expect(names).toContain('token.cost');
  });
});
