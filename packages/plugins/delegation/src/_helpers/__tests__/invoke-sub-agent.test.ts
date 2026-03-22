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

vi.mock('../persist-delegation-activity', () => ({
  persistDelegationActivity: vi.fn().mockResolvedValue(undefined),
}));

import { invokeSubAgent } from '../invoke-sub-agent';
import { persistDelegationActivity } from '../persist-delegation-activity';

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
      onMessage: expect.any(Function),
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
      onMessage: expect.any(Function),
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

  it('wraps onMessage callback to collect events and forward to caller', async () => {
    const ctx = createMockContext();
    const callerOnMessage = vi.fn();

    // Make invoke call the onMessage callback with test events
    (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mockImplementation(async (_prompt, opts) => {
      opts?.onMessage?.({ type: 'thinking', content: 'Hmm', timestamp: 1000 });
      opts?.onMessage?.({ type: 'tool_call', toolName: 'Bash', timestamp: 2000 });
      return { output: 'Done', durationMs: 1500, exitCode: 0 };
    });

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined, callerOnMessage);

    // Caller's callback should have been called for each event
    expect(callerOnMessage).toHaveBeenCalledTimes(2);
    expect(callerOnMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'thinking' }));
    expect(callerOnMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'tool_call' }));

    // persistDelegationActivity should have received the collected events
    expect(persistDelegationActivity).toHaveBeenCalledWith(
      ctx,
      'thread-1',
      expect.arrayContaining([expect.objectContaining({ type: 'thinking' }), expect.objectContaining({ type: 'tool_call' })]),
      expect.objectContaining({ output: 'Done' }),
      undefined,
    );
  });

  it('calls persistDelegationActivity even without caller onMessage', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    expect(persistDelegationActivity).toHaveBeenCalledWith(
      ctx,
      'thread-1',
      [], // no events emitted
      expect.objectContaining({ output: 'Agent output here' }),
      undefined,
    );
  });

  it('passes traceId to invoke options and persistDelegationActivity', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined, undefined, 'trace-abc-123');

    expect(ctx.invoker.invoke).toHaveBeenCalledWith('Do work', expect.objectContaining({ traceId: 'trace-abc-123' }));
    expect(persistDelegationActivity).toHaveBeenCalledWith(ctx, 'thread-1', expect.any(Array), expect.anything(), 'trace-abc-123');
  });

  it('passes taskId through InvokeOptions', async () => {
    const ctx = createMockContext();

    await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    expect(ctx.invoker.invoke).toHaveBeenCalledWith('Do work', expect.objectContaining({ taskId: 'task-1' }));
  });

  it('does not throw if persistDelegationActivity fails', async () => {
    const ctx = createMockContext();
    (persistDelegationActivity as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB write failed'));

    // Should not throw — persistence failure is caught and logged
    const result = await invokeSubAgent(ctx, 'Do work', 'task-1', 'thread-1', undefined);

    expect(result.output).toBe('Agent output here');
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      'delegation: failed to persist activity records',
      expect.objectContaining({ threadId: 'thread-1', taskId: 'task-1' }),
    );
  });
});
