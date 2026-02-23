// Tests for start-delegation helper

import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { startDelegation } from '../start-delegation';

type MockTransaction = {
  thread: { create: ReturnType<typeof vi.fn> };
  orchestratorTask: { create: ReturnType<typeof vi.fn> };
};

type CreateMockContext = () => {
  ctx: PluginContext;
  mockTx: MockTransaction;
};

const createMockContext: CreateMockContext = () => {
  const mockTx: MockTransaction = {
    thread: {
      create: vi.fn().mockResolvedValue({ id: 'thread-abc-123' }),
    },
    orchestratorTask: {
      create: vi.fn().mockResolvedValue({ id: 'task-xyz-789' }),
    },
  };

  const ctx = {
    db: {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: MockTransaction) => Promise<unknown>) => fn(mockTx)),
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    config: { claudeModel: 'claude-sonnet-4-20250514' },
  } as unknown as PluginContext;

  return { ctx, mockTx };
};

describe('startDelegation', () => {
  it('creates both a thread and a task in a transaction', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Research AI safety',
    });

    expect(mockTx.thread.create).toHaveBeenCalledTimes(1);
    expect(mockTx.orchestratorTask.create).toHaveBeenCalledTimes(1);
  });

  it('uses $transaction for atomicity', async () => {
    const { ctx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Do work',
    });

    expect((ctx.db as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction).toHaveBeenCalledTimes(1);
  });

  it('sets the thread kind to task', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Build feature',
    });

    const threadData = mockTx.thread.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(threadData.data.kind).toBe('task');
  });

  it('sets the thread source to delegation', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Do something',
    });

    const threadData = mockTx.thread.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(threadData.data.source).toBe('delegation');
  });

  it('links thread to parent via parentThreadId', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-thread-42',
      prompt: 'Research topic',
    });

    const threadData = mockTx.thread.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(threadData.data.parentThreadId).toBe('parent-thread-42');
  });

  it('sets task status to pending', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Do work',
    });

    const taskData = mockTx.orchestratorTask.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(taskData.data.status).toBe('pending');
  });

  it('stores the prompt in the task record', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Write comprehensive tests for the module',
    });

    const taskData = mockTx.orchestratorTask.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(taskData.data.prompt).toBe('Write comprehensive tests for the module');
  });

  it('defaults maxIterations to 5 when not provided', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Do work',
    });

    const taskData = mockTx.orchestratorTask.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(taskData.data.maxIterations).toBe(5);
  });

  it('uses provided maxIterations', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Do work',
      maxIterations: 10,
    });

    const taskData = mockTx.orchestratorTask.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(taskData.data.maxIterations).toBe(10);
  });

  it('sets currentIteration to 0', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Do work',
    });

    const taskData = mockTx.orchestratorTask.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(taskData.data.currentIteration).toBe(0);
  });

  it('links the task to the created thread', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Do work',
    });

    const taskData = mockTx.orchestratorTask.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(taskData.data.threadId).toBe('thread-abc-123');
  });

  it('returns the task and thread IDs', async () => {
    const { ctx } = createMockContext();

    const result = await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Do work',
    });

    expect(result.taskId).toBe('task-xyz-789');
    expect(result.threadId).toBe('thread-abc-123');
  });

  it('sets thread status to active', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Do work',
    });

    const threadData = mockTx.thread.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(threadData.data.status).toBe('active');
  });

  it('truncates long prompts in the thread name', async () => {
    const { ctx, mockTx } = createMockContext();
    const longPrompt = 'A'.repeat(200);

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: longPrompt,
    });

    const threadData = mockTx.thread.create.mock.calls[0]?.[0] as {
      data: { name: string };
    };
    expect(threadData.data.name.length).toBeLessThan(100);
    expect(threadData.data.name).toContain('Task: ');
  });

  it('generates a unique sourceId for the thread', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Do work',
    });

    const threadData = mockTx.thread.create.mock.calls[0]?.[0] as {
      data: { sourceId: string };
    };
    expect(threadData.data.sourceId).toMatch(/^task-\d+-[a-z0-9]+$/);
  });

  it('sets lastActivity on the thread', async () => {
    const { ctx, mockTx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Do work',
    });

    const threadData = mockTx.thread.create.mock.calls[0]?.[0] as {
      data: { lastActivity: unknown };
    };
    expect(threadData.data.lastActivity).toBeInstanceOf(Date);
  });

  it('logs the delegation start with task and thread IDs', async () => {
    const { ctx } = createMockContext();

    await startDelegation(ctx, {
      parentThreadId: 'parent-1',
      prompt: 'Do work',
    });

    expect(ctx.logger.info).toHaveBeenCalledWith(
      'Delegation started: task task-xyz-789 in thread thread-abc-123',
      expect.objectContaining({
        parentThreadId: 'parent-1',
        maxIterations: 5,
      }),
    );
  });
});
