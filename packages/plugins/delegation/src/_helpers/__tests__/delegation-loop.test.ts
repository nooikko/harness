import type { InvokeResult, PluginContext, PluginHooks } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/plugin-contract', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@harness/plugin-contract')>();
  return {
    ...actual,
    getModelCost: vi.fn().mockImplementation((_model: string, input: number, output: number) => {
      if (input === 0 && output === 0) {
        return 0;
      }
      return (input / 1_000_000) * 3 + (output / 1_000_000) * 15;
    }),
    isKnownModel: vi.fn().mockReturnValue(true),
  };
});

import { runDelegationLoop } from '../delegation-loop';

vi.mock('../calculate-backoff-ms', () => ({
  calculateBackoffMs: vi.fn().mockReturnValue(0),
}));

type MockDb = {
  $transaction: ReturnType<typeof vi.fn>;
  thread: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  orchestratorTask: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  message: {
    create: ReturnType<typeof vi.fn>;
  };
  agentRun: {
    create: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
  };
  metric: {
    createMany: ReturnType<typeof vi.fn>;
  };
};

type CreateMockContext = (overrides?: { invokeResult?: Partial<InvokeResult> }) => {
  ctx: PluginContext;
  db: MockDb;
};

const createMockContext: CreateMockContext = (overrides) => {
  const db: MockDb = {
    thread: {
      findUnique: vi.fn().mockResolvedValue({ projectId: 'project-1', agentId: 'agent-1' }),
      create: vi.fn().mockResolvedValue({ id: 'thread-task-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    orchestratorTask: {
      create: vi.fn().mockResolvedValue({ id: 'task-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    message: {
      create: vi.fn().mockResolvedValue({}),
    },
    agentRun: {
      create: vi.fn().mockResolvedValue({ id: 'run-123' }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { costEstimate: 0 } }),
    },
    metric: {
      createMany: vi.fn().mockResolvedValue({ count: 4 }),
    },
    // $transaction executes the callback with the same db as the tx client
    $transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };

  const defaultInvokeResult: InvokeResult = {
    output: 'Task completed successfully',
    durationMs: 1000,
    exitCode: 0,
    ...(overrides?.invokeResult ?? {}),
  };

  const ctx: PluginContext = {
    db: db as never,
    invoker: {
      invoke: vi.fn().mockResolvedValue(defaultInvokeResult),
    },
    config: {
      claudeModel: 'claude-sonnet-4-20250514',
      databaseUrl: '',
      timezone: 'UTC',
      maxConcurrentAgents: 5,
      claudeTimeout: 30000,
      discordToken: undefined,
      discordChannelId: undefined,
      port: 3001,
      logLevel: 'info',
      uploadDir: '/tmp/uploads',
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    sendToThread: vi.fn(),
    broadcast: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({}),
    notifySettingsChange: vi.fn().mockResolvedValue(undefined),
    reportStatus: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
  };

  return { ctx, db };
};

describe('runDelegationLoop', () => {
  let mockCtx: PluginContext;
  let mockDb: MockDb;

  beforeEach(() => {
    const { ctx, db } = createMockContext();
    mockCtx = ctx;
    mockDb = db;
  });

  it('creates a task thread linked to the parent thread', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do research on topic X',
      parentThreadId: 'parent-thread-1',
    });

    expect(mockDb.thread.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'delegation',
        kind: 'task',
        status: 'active',
        parentThreadId: 'parent-thread-1',
        name: expect.stringContaining('Task: Do research on topic X'),
      }),
    });
  });

  it('inherits projectId from the parent thread', async () => {
    const hooks: PluginHooks[] = [];
    mockDb.thread.findUnique.mockResolvedValue({ projectId: 'proj-abc', agentId: 'agent-abc' });

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-thread-1',
    });

    expect(mockDb.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'parent-thread-1' },
      select: { projectId: true, agentId: true },
    });
    expect(mockDb.thread.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'proj-abc',
        agentId: 'agent-abc',
      }),
    });
  });

  it('handles parent thread with no projectId', async () => {
    const hooks: PluginHooks[] = [];
    mockDb.thread.findUnique.mockResolvedValue({ projectId: null, agentId: null });

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-thread-1',
    });

    expect(mockDb.thread.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: null,
      }),
    });
  });

  it('creates a task record in the database', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Write a report',
      parentThreadId: 'parent-thread-1',
    });

    expect(mockDb.orchestratorTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        threadId: 'thread-task-1',
        prompt: 'Write a report',
        status: 'pending',
        maxIterations: 5,
        currentIteration: 0,
      }),
    });
  });

  it('uses default max iterations of 5 when not specified', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    expect(mockDb.orchestratorTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        maxIterations: 5,
      }),
    });
  });

  it('respects custom max iterations', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
      maxIterations: 3,
    });

    expect(mockDb.orchestratorTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        maxIterations: 3,
      }),
    });
  });

  it('fires onTaskCreate hooks before invocation', async () => {
    const onTaskCreate = vi.fn();
    const hooks: PluginHooks[] = [{ onTaskCreate }];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Build feature',
      parentThreadId: 'parent-1',
    });

    expect(onTaskCreate).toHaveBeenCalledWith('thread-task-1', 'task-1');
    // onTaskCreate should fire before invoker is called
    expect(onTaskCreate.mock.invocationCallOrder[0]).toBeLessThan(
      (mockCtx.invoker.invoke as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('invokes the sub-agent with the prompt', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Research topic',
      parentThreadId: 'parent-1',
    });

    expect(mockCtx.invoker.invoke).toHaveBeenCalledWith('Research topic', {
      model: undefined,
      threadId: 'thread-task-1',
      timeout: 30000,
      onMessage: expect.any(Function),
      traceId: undefined,
      taskId: 'task-1',
    });
  });

  it('passes model to sub-agent invocation', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Research topic',
      parentThreadId: 'parent-1',
      model: 'claude-opus-4-20250514',
    });

    expect(mockCtx.invoker.invoke).toHaveBeenCalledWith('Research topic', {
      model: 'claude-opus-4-20250514',
      threadId: 'thread-task-1',
      timeout: 30000,
      onMessage: expect.any(Function),
      traceId: undefined,
      taskId: 'task-1',
    });
  });

  it('forwards traceId from options to sub-agent invocation', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Research topic',
      parentThreadId: 'parent-1',
      traceId: 'trace-xyz-456',
    });

    expect(mockCtx.invoker.invoke).toHaveBeenCalledWith('Research topic', {
      model: undefined,
      threadId: 'thread-task-1',
      timeout: 30000,
      onMessage: expect.any(Function),
      traceId: 'trace-xyz-456',
      taskId: 'task-1',
    });
  });

  it('records the agent run after invocation', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    expect(mockDb.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        threadId: 'thread-task-1',
        taskId: 'task-1',
        model: 'claude-sonnet-4-20250514',
        durationMs: 1000,
        status: 'completed',
      }),
    });
  });

  it('persists sub-agent messages in the task thread', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    // Should have user message (prompt) and assistant message (output)
    const messageCalls = mockDb.message.create.mock.calls;
    expect(messageCalls.length).toBeGreaterThanOrEqual(2);

    // First call is the user prompt message
    expect(messageCalls[0]?.[0]).toEqual({
      data: expect.objectContaining({
        threadId: 'thread-task-1',
        role: 'user',
        content: 'Do work',
      }),
    });

    // Second call is the assistant response
    expect(messageCalls[1]?.[0]).toEqual({
      data: expect.objectContaining({
        threadId: 'thread-task-1',
        role: 'assistant',
        content: 'Task completed successfully',
      }),
    });
  });

  it('fires onTaskComplete hooks after invocation', async () => {
    const onTaskComplete = vi.fn();
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    expect(onTaskComplete).toHaveBeenCalledWith('thread-task-1', 'task-1', 'Task completed successfully');
  });

  it('marks task as completed when hooks accept', async () => {
    const hooks: PluginHooks[] = [];

    const result = await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    expect(result.status).toBe('completed');
    expect(result.result).toBe('Task completed successfully');
    expect(result.iterations).toBe(1);

    // Task should be updated to completed
    expect(mockDb.orchestratorTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'completed',
        result: 'Task completed successfully',
      }),
    });
  });

  it('re-delegates when onTaskComplete hook throws', async () => {
    let callCount = 0;
    const onTaskComplete = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Validation failed: code quality issues');
      }
      // Accept on second try
    });
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    const result = await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Write code',
      parentThreadId: 'parent-1',
      maxIterations: 3,
    });

    expect(result.status).toBe('completed');
    expect(result.iterations).toBe(2);
    expect(onTaskComplete).toHaveBeenCalledTimes(2);
  });

  it('includes feedback in re-delegation prompt', async () => {
    let callCount = 0;
    const onTaskComplete = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Missing tests');
      }
    });
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Write code',
      parentThreadId: 'parent-1',
      maxIterations: 3,
    });

    // The second invocation should include feedback
    const invokeCalls = (mockCtx.invoker.invoke as ReturnType<typeof vi.fn>).mock.calls;
    expect(invokeCalls.length).toBe(2);
    const secondPrompt = invokeCalls[1]?.[0] as string;
    expect(secondPrompt).toContain('Write code');
    expect(secondPrompt).toContain('Previous attempt was rejected');
    expect(secondPrompt).toContain('Missing tests');
  });

  it('fails after max iterations are exhausted', async () => {
    const onTaskComplete = vi.fn().mockImplementation(async () => {
      throw new Error('Always fails');
    });
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    const result = await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Impossible task',
      parentThreadId: 'parent-1',
      maxIterations: 2,
    });

    expect(result.status).toBe('failed');
    expect(result.result).toBeNull();
    expect(result.iterations).toBe(2);

    // Task should be marked as failed
    expect(mockDb.orchestratorTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { status: 'failed' },
    });
  });

  it('fires onTaskFailed hooks when max iterations exhausted', async () => {
    const onTaskComplete = vi.fn().mockRejectedValue(new Error('Nope'));
    const onTaskFailed = vi.fn();
    const hooks: PluginHooks[] = [{ onTaskComplete, onTaskFailed }];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Impossible task',
      parentThreadId: 'parent-1',
      maxIterations: 1,
    });

    expect(onTaskFailed).toHaveBeenCalledWith(
      'thread-task-1',
      'task-1',
      expect.objectContaining({
        message: expect.stringContaining('failed after 1 iteration(s)'),
      }),
    );
  });

  it('broadcasts task lifecycle events', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    const broadcastCalls = (mockCtx.broadcast as ReturnType<typeof vi.fn>).mock.calls;
    const events = broadcastCalls.map((call) => call[0]);

    expect(events).toContain('task:created');
    expect(events).toContain('task:evaluated');
    expect(events).toContain('task:validated');
  });

  it('broadcasts task:failed on failure', async () => {
    const onTaskComplete = vi.fn().mockRejectedValue(new Error('Reject'));
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Fail task',
      parentThreadId: 'parent-1',
      maxIterations: 1,
    });

    const broadcastCalls = (mockCtx.broadcast as ReturnType<typeof vi.fn>).mock.calls;
    const events = broadcastCalls.map((call) => call[0]);

    expect(events).toContain('task:failed');
  });

  it('notifies parent thread on successful completion via sendToThread', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    // sendThreadNotification calls ctx.sendToThread on the parent thread
    expect(mockCtx.sendToThread).toHaveBeenCalledWith('parent-1', expect.stringContaining('Delegation task completed in 1 iteration(s).'));
    // Result should be included for parent agent evaluation
    expect(mockCtx.sendToThread).toHaveBeenCalledWith('parent-1', expect.stringContaining('Task completed successfully'));
  });

  it('notifies parent thread on failure via sendToThread', async () => {
    const onTaskComplete = vi.fn().mockRejectedValue(new Error('Nope'));
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Fail task',
      parentThreadId: 'parent-1',
      maxIterations: 1,
    });

    // sendThreadNotification calls ctx.sendToThread on the parent thread
    expect(mockCtx.sendToThread).toHaveBeenCalledWith('parent-1', expect.stringContaining('Delegation task failed after 1 iteration(s).'));
  });

  it('updates task status through the lifecycle', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    const updateCalls = mockDb.orchestratorTask.update.mock.calls;

    // Should transition: pending -> running -> evaluating -> completed
    const statuses = updateCalls.map((call) => (call[0] as { data: { status?: string } }).data.status);
    expect(statuses).toContain('running');
    expect(statuses).toContain('evaluating');
    expect(statuses).toContain('completed');
  });

  it('handles sub-agent invocation failure with retry', async () => {
    let callCount = 0;
    const invokeMock = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { output: '', durationMs: 100, exitCode: 1, error: 'Process crashed' };
      }
      return { output: 'Fixed output', durationMs: 500, exitCode: 0 };
    });

    const { ctx, db: _db } = createMockContext();
    (ctx as unknown as { invoker: { invoke: ReturnType<typeof vi.fn> } }).invoker.invoke = invokeMock;
    const hooks: PluginHooks[] = [];

    const result = await runDelegationLoop(ctx, hooks, {
      prompt: 'Retry task',
      parentThreadId: 'parent-1',
      maxIterations: 3,
    });

    expect(result.status).toBe('completed');
    expect(result.iterations).toBe(2);
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it('updates thread status on completion', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    expect(mockDb.thread.update).toHaveBeenCalledWith({
      where: { id: 'thread-task-1' },
      data: expect.objectContaining({ status: 'completed' }),
    });
  });

  it('updates thread status on failure', async () => {
    const onTaskComplete = vi.fn().mockRejectedValue(new Error('Nope'));
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Fail',
      parentThreadId: 'parent-1',
      maxIterations: 1,
    });

    expect(mockDb.thread.update).toHaveBeenCalledWith({
      where: { id: 'thread-task-1' },
      data: expect.objectContaining({ status: 'failed' }),
    });
  });

  it('handles onTaskCreate hook errors gracefully', async () => {
    const onTaskCreate = vi.fn().mockRejectedValue(new Error('Setup failed'));
    const hooks: PluginHooks[] = [{ onTaskCreate }];

    // Should still proceed with the delegation loop
    const result = await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work despite setup error',
      parentThreadId: 'parent-1',
    });

    expect(result.status).toBe('completed');
    expect(mockCtx.logger.error).toHaveBeenCalledWith(expect.stringContaining('onTaskCreate'), expect.anything());
  });

  it('handles onTaskFailed hook errors gracefully', async () => {
    const onTaskComplete = vi.fn().mockRejectedValue(new Error('Reject'));
    const onTaskFailed = vi.fn().mockRejectedValue(new Error('Cleanup also failed'));
    const hooks: PluginHooks[] = [{ onTaskComplete, onTaskFailed }];

    // Should not throw even if onTaskFailed throws
    const result = await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Fail',
      parentThreadId: 'parent-1',
      maxIterations: 1,
    });

    expect(result.status).toBe('failed');
    expect(mockCtx.logger.error).toHaveBeenCalledWith(expect.stringContaining('onTaskFailed'), expect.anything());
  });

  it('fires multiple onTaskCreate hooks from different plugins', async () => {
    const hook1 = vi.fn();
    const hook2 = vi.fn();
    const hooks: PluginHooks[] = [{ onTaskCreate: hook1 }, { onTaskCreate: hook2 }];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Multi-hook task',
      parentThreadId: 'parent-1',
    });

    expect(hook1).toHaveBeenCalledTimes(1);
    expect(hook2).toHaveBeenCalledTimes(1);
  });

  it('returns correct taskId and threadId', async () => {
    const hooks: PluginHooks[] = [];

    const result = await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    expect(result.taskId).toBe('task-1');
    expect(result.threadId).toBe('thread-task-1');
  });

  it('truncates long prompts in thread name', async () => {
    const hooks: PluginHooks[] = [];
    const longPrompt = 'A'.repeat(200);

    await runDelegationLoop(mockCtx, hooks, {
      prompt: longPrompt,
      parentThreadId: 'parent-1',
    });

    const createCall = mockDb.thread.create.mock.calls[0]?.[0] as { data: { name: string } };
    expect(createCall.data.name.length).toBeLessThan(100);
  });

  it('handles sub-agent failure with no error message', async () => {
    const invokeMock = vi.fn().mockResolvedValue({
      output: '',
      durationMs: 100,
      exitCode: 1,
      error: undefined,
    });

    const { ctx } = createMockContext();
    (ctx as unknown as { invoker: { invoke: ReturnType<typeof vi.fn> } }).invoker.invoke = invokeMock;
    const hooks: PluginHooks[] = [];

    const result = await runDelegationLoop(ctx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
      maxIterations: 1,
    });

    // Should fail after max iterations with "unknown error" in feedback
    expect(result.status).toBe('failed');
  });

  it('handles onTaskComplete throwing non-Error value', async () => {
    const onTaskComplete = vi.fn().mockRejectedValue('string error');
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    const result = await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
      maxIterations: 1,
    });

    expect(result.status).toBe('failed');
    expect(mockCtx.logger.error).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });

  it('handles onTaskFailed throwing non-Error value', async () => {
    const onTaskComplete = vi.fn().mockRejectedValue(new Error('Reject'));
    const onTaskFailed = vi.fn().mockRejectedValue('not an Error object');
    const hooks: PluginHooks[] = [{ onTaskComplete, onTaskFailed }];

    const result = await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Fail',
      parentThreadId: 'parent-1',
      maxIterations: 1,
    });

    expect(result.status).toBe('failed');
    expect(mockCtx.logger.error).toHaveBeenCalledWith(expect.stringContaining('not an Error object'), expect.anything());
  });

  it('handles onTaskCreate throwing non-Error value', async () => {
    const onTaskCreate = vi.fn().mockRejectedValue(42);
    const hooks: PluginHooks[] = [{ onTaskCreate }];

    const result = await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    expect(result.status).toBe('completed');
    expect(mockCtx.logger.error).toHaveBeenCalledWith(expect.stringContaining('42'), expect.anything());
  });

  it('uses fallback feedback when task rejected without specific feedback', async () => {
    // Create a hook that throws an error with no message for the onTaskComplete rejection
    // But also we need to test the outcome.feedback ?? path
    // The outcome.feedback ?? branch is at line 305 - when hooks accept
    // but we need to get to the rejection path with no feedback
    let callCount = 0;
    const onTaskComplete = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        throw new Error('');
      }
      // Accept on third try
    });
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    const result = await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
      maxIterations: 3,
    });

    expect(result.status).toBe('completed');
    expect(result.iterations).toBe(3);
  });

  it('records agent run as failed when exit code is non-zero', async () => {
    const invokeMock = vi.fn().mockResolvedValue({
      output: '',
      durationMs: 100,
      exitCode: 2,
      error: 'Timeout',
    });

    const { ctx, db } = createMockContext();
    (ctx as unknown as { invoker: { invoke: ReturnType<typeof vi.fn> } }).invoker.invoke = invokeMock;
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(ctx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
      maxIterations: 1,
    });

    expect(db.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'failed',
        error: 'Timeout',
      }),
    });
  });

  it('records agent run with explicit model when provided', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
      model: 'claude-opus-4-20250514',
    });

    expect(mockDb.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        model: 'claude-opus-4-20250514',
      }),
    });
  });

  it('handles null exit code from sub-agent gracefully', async () => {
    const invokeMock = vi.fn().mockResolvedValue({
      output: 'Output from null exit',
      durationMs: 200,
      exitCode: null,
    });

    const { ctx } = createMockContext();
    (ctx as unknown as { invoker: { invoke: ReturnType<typeof vi.fn> } }).invoker.invoke = invokeMock;
    const hooks: PluginHooks[] = [];

    const result = await runDelegationLoop(ctx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    // null exitCode should not trigger the failure branch
    expect(result.status).toBe('completed');
  });

  it('fails immediately with zero max iterations', async () => {
    const hooks: PluginHooks[] = [];

    const result = await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Zero iterations',
      parentThreadId: 'parent-1',
      maxIterations: 0,
    });

    // Loop body never executes, goes straight to failure
    expect(result.status).toBe('failed');
    expect(result.iterations).toBe(0);
    expect(mockCtx.invoker.invoke).not.toHaveBeenCalled();

    // sendThreadNotification calls ctx.sendToThread on the parent thread
    expect(mockCtx.sendToThread).toHaveBeenCalledWith('parent-1', expect.stringContaining('Delegation task failed after 0 iteration(s).'));
  });

  it('includes feedback in failure notification when sub-agent had non-zero exit', async () => {
    const invokeFail = vi.fn().mockResolvedValue({
      output: '',
      durationMs: 100,
      exitCode: 1,
    });

    const { ctx } = createMockContext();
    (ctx as unknown as { invoker: { invoke: ReturnType<typeof vi.fn> } }).invoker.invoke = invokeFail;

    const hooks: PluginHooks[] = [];

    const result = await runDelegationLoop(ctx, hooks, {
      prompt: 'Fail immediately',
      parentThreadId: 'parent-1',
      maxIterations: 1,
    });

    expect(result.status).toBe('failed');

    // sendThreadNotification calls ctx.sendToThread on the parent thread
    expect(ctx.sendToThread).toHaveBeenCalledWith('parent-1', expect.stringContaining('Delegation task failed after 1 iteration(s).'));
  });

  it('cost cap stops the loop when budget is exceeded after a failed invoke', async () => {
    const invokeMock = vi.fn().mockResolvedValue({
      output: '',
      durationMs: 200,
      exitCode: 1,
      error: 'timeout',
    });

    const { ctx, db } = createMockContext();
    (ctx as unknown as { invoker: { invoke: ReturnType<typeof vi.fn> } }).invoker.invoke = invokeMock;
    // Simulate $5.00 already spent — at or above the $5 cap
    db.agentRun.aggregate.mockResolvedValue({ _sum: { costEstimate: 5.0 } });

    const hooks: PluginHooks[] = [];

    const result = await runDelegationLoop(ctx, hooks, {
      prompt: 'Expensive task',
      parentThreadId: 'parent-1',
      maxIterations: 10,
    });

    // Loop must exit before maxIterations — cost cap triggered after first failure
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('failed');

    // task:cost-cap must have been broadcast
    const broadcastCalls = (ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls;
    const costCapEvent = broadcastCalls.find((call) => call[0] === 'task:cost-cap');
    expect(costCapEvent).toBeDefined();
    expect(costCapEvent?.[1]).toMatchObject({ spent: 5.0, cap: 5 });
  });

  it('circuit breaker fast-fails on logic-error without retrying', async () => {
    const invokeMock = vi.fn().mockResolvedValue({
      output: '',
      durationMs: 100,
      exitCode: 1,
      error: 'JSON parse error in tool call',
    });

    const { ctx } = createMockContext();
    (ctx as unknown as { invoker: { invoke: ReturnType<typeof vi.fn> } }).invoker.invoke = invokeMock;

    const hooks: PluginHooks[] = [];

    const result = await runDelegationLoop(ctx, hooks, {
      prompt: 'Bad schema task',
      parentThreadId: 'parent-1',
      maxIterations: 5,
    });

    // Logic errors must break immediately — no retries
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('failed');
    // Must return actual iteration count (1), not maxIterations (5)
    expect(result.iterations).toBe(1);
  });

  it('circuit breaker retries on timeout and succeeds on the third attempt', async () => {
    let callCount = 0;
    const invokeMock = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        return { output: '', durationMs: 300000, exitCode: 1, error: 'Timed out after 300000ms' };
      }
      return { output: 'done', durationMs: 500, exitCode: 0 };
    });

    const { ctx } = createMockContext();
    (ctx as unknown as { invoker: { invoke: ReturnType<typeof vi.fn> } }).invoker.invoke = invokeMock;

    const hooks: PluginHooks[] = [];

    const result = await runDelegationLoop(ctx, hooks, {
      prompt: 'Flaky task',
      parentThreadId: 'parent-1',
      maxIterations: 5,
    });

    // Must have retried — invoked 3 times total (2 timeouts + 1 success)
    expect(invokeMock).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('completed');
    expect(result.result).toBe('done');
  });

  it('cost cap stops the loop when budget is exceeded after validator rejection', async () => {
    // Validator rejects on first pass, cost is over cap
    let callCount = 0;
    const onTaskComplete = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Quality too low');
      }
    });
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    const { ctx, db } = createMockContext();
    // After first iteration, cost query returns over-cap amount
    db.agentRun.aggregate.mockResolvedValue({ _sum: { costEstimate: 6.0 } });

    const result = await runDelegationLoop(ctx, hooks, {
      prompt: 'Expensive rejected task',
      parentThreadId: 'parent-1',
      maxIterations: 5,
      costCapUsd: 5,
    });

    // Loop must exit after 1 iteration — cost cap hit after rejection
    expect(result.status).toBe('failed');
    expect(result.iterations).toBe(1);
    expect(ctx.invoker.invoke as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);

    // task:cost-cap must have been broadcast
    const broadcastCalls = (ctx.broadcast as ReturnType<typeof vi.fn>).mock.calls;
    const costCapEvent = broadcastCalls.find((call) => call[0] === 'task:cost-cap');
    expect(costCapEvent).toBeDefined();
    expect(costCapEvent?.[1]).toMatchObject({ spent: 6.0, cap: 5 });
  });

  it('propagates error when orchestratorTask.update throws mid-loop', async () => {
    const { ctx, db } = createMockContext();
    // First update call (status: running) succeeds, second (status: evaluating) throws
    let updateCount = 0;
    db.orchestratorTask.update.mockImplementation(async () => {
      updateCount++;
      if (updateCount === 2) {
        throw new Error('DB connection lost');
      }
      return {};
    });

    const hooks: PluginHooks[] = [];

    await expect(
      runDelegationLoop(ctx, hooks, {
        prompt: 'DB crash task',
        parentThreadId: 'parent-1',
      }),
    ).rejects.toThrow('DB connection lost');
  });

  it('propagates error when invoker.invoke rejects with thrown Error', async () => {
    const { ctx } = createMockContext();
    (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('SDK subprocess crashed'));

    const hooks: PluginHooks[] = [];

    await expect(
      runDelegationLoop(ctx, hooks, {
        prompt: 'SDK crash task',
        parentThreadId: 'parent-1',
      }),
    ).rejects.toThrow('SDK subprocess crashed');
  });
});
