import type { InvokeResult, PluginContext, PluginHooks } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runDelegationLoop } from '../delegation-loop';

type MockDb = {
  thread: {
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
  };
};

type CreateMockContext = (overrides?: { invokeResult?: Partial<InvokeResult> }) => {
  ctx: PluginContext;
  db: MockDb;
};

const createMockContext: CreateMockContext = (overrides) => {
  const db: MockDb = {
    thread: {
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
      create: vi.fn().mockResolvedValue({}),
    },
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
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    sendToThread: vi.fn(),
    broadcast: vi.fn(),
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

    expect(mockCtx.invoker.invoke).toHaveBeenCalledWith('Research topic', { model: undefined });
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
        message: expect.stringContaining('failed after 1 iterations'),
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

  it('notifies parent thread on successful completion via cross-thread notification', async () => {
    const hooks: PluginHooks[] = [];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    // sendThreadNotification creates a system message in the parent thread
    const messageCalls = mockDb.message.create.mock.calls;
    const notificationCall = messageCalls.find(
      (call) => (call[0] as { data: { metadata?: { type?: string } } }).data.metadata?.type === 'cross-thread-notification',
    );
    expect(notificationCall).toBeDefined();

    const notificationData = (notificationCall?.[0] as { data: { threadId: string; role: string; metadata: { status: string } } }).data;
    expect(notificationData.threadId).toBe('parent-1');
    expect(notificationData.role).toBe('system');
    expect(notificationData.metadata.status).toBe('completed');
  });

  it('notifies parent thread on failure via cross-thread notification', async () => {
    const onTaskComplete = vi.fn().mockRejectedValue(new Error('Nope'));
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Fail task',
      parentThreadId: 'parent-1',
      maxIterations: 1,
    });

    // sendThreadNotification creates a system message in the parent thread
    const messageCalls = mockDb.message.create.mock.calls;
    const notificationCall = messageCalls.find(
      (call) => (call[0] as { data: { metadata?: { type?: string } } }).data.metadata?.type === 'cross-thread-notification',
    );
    expect(notificationCall).toBeDefined();

    const notificationData = (notificationCall?.[0] as { data: { threadId: string; metadata: { status: string } } }).data;
    expect(notificationData.threadId).toBe('parent-1');
    expect(notificationData.metadata.status).toBe('failed');
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
    expect(mockCtx.logger.error).toHaveBeenCalledWith(expect.stringContaining('onTaskCreate'));
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
    expect(mockCtx.logger.error).toHaveBeenCalledWith(expect.stringContaining('onTaskFailed'));
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
    expect(mockCtx.logger.error).toHaveBeenCalledWith(expect.stringContaining('not an Error object'));
  });

  it('handles onTaskCreate throwing non-Error value', async () => {
    const onTaskCreate = vi.fn().mockRejectedValue(42);
    const hooks: PluginHooks[] = [{ onTaskCreate }];

    const result = await runDelegationLoop(mockCtx, hooks, {
      prompt: 'Do work',
      parentThreadId: 'parent-1',
    });

    expect(result.status).toBe('completed');
    expect(mockCtx.logger.error).toHaveBeenCalledWith(expect.stringContaining('42'));
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

    // sendThreadNotification creates a cross-thread notification in the parent thread
    const messageCalls = mockDb.message.create.mock.calls;
    const notificationCall = messageCalls.find(
      (call) => (call[0] as { data: { metadata?: { type?: string } } }).data.metadata?.type === 'cross-thread-notification',
    );
    expect(notificationCall).toBeDefined();
    const notificationData = (notificationCall?.[0] as { data: { metadata: { status: string } } }).data;
    expect(notificationData.metadata.status).toBe('failed');
  });

  it('includes feedback in failure notification when sub-agent had non-zero exit', async () => {
    const invokeFail = vi.fn().mockResolvedValue({
      output: '',
      durationMs: 100,
      exitCode: 1,
    });

    const { ctx, db } = createMockContext();
    (ctx as unknown as { invoker: { invoke: ReturnType<typeof vi.fn> } }).invoker.invoke = invokeFail;

    const hooks: PluginHooks[] = [];

    const result = await runDelegationLoop(ctx, hooks, {
      prompt: 'Fail immediately',
      parentThreadId: 'parent-1',
      maxIterations: 1,
    });

    expect(result.status).toBe('failed');

    // sendThreadNotification creates a cross-thread notification in the parent thread
    const messageCalls = db.message.create.mock.calls;
    const notificationCall = messageCalls.find(
      (call) => (call[0] as { data: { metadata?: { type?: string } } }).data.metadata?.type === 'cross-thread-notification',
    );
    expect(notificationCall).toBeDefined();
    const notificationData = (notificationCall?.[0] as { data: { content: string; metadata: { status: string } } }).data;
    expect(notificationData.metadata.status).toBe('failed');
    expect(notificationData.content).toContain('failed');
  });
});
