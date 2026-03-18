import type { PluginContext } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DelegationOptions } from '../setup-delegation-task';
import { setupDelegationTask } from '../setup-delegation-task';

const mockThreadCreate = vi.fn();
const mockTaskCreate = vi.fn();
const mockThreadFindUnique = vi.fn();

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () => ({
  db: {
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        thread: {
          create: (...args: unknown[]) => mockThreadCreate(...args),
          findUnique: (...args: unknown[]) => mockThreadFindUnique(...args),
        },
        orchestratorTask: {
          create: (...args: unknown[]) => mockTaskCreate(...args),
        },
      }),
    ),
  } as never,
  invoker: { invoke: vi.fn() },
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
});

type MakeOptions = (overrides?: Partial<DelegationOptions>) => DelegationOptions;

const makeOptions: MakeOptions = (overrides) => ({
  prompt: 'Fix the failing tests',
  parentThreadId: 'parent-thread-1',
  ...overrides,
});

describe('setupDelegationTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockThreadFindUnique.mockResolvedValue({ projectId: 'project-1' });
    mockThreadCreate.mockResolvedValue({ id: 'new-thread-1' });
    mockTaskCreate.mockResolvedValue({ id: 'new-task-1' });
  });

  it('task thread inherits projectId from parent thread', async () => {
    const ctx = createMockContext();
    mockThreadFindUnique.mockResolvedValue({ projectId: 'project-42' });

    await setupDelegationTask(ctx, [], makeOptions());

    expect(mockThreadFindUnique).toHaveBeenCalledWith({
      where: { id: 'parent-thread-1' },
      select: { projectId: true },
    });
    expect(mockThreadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-42',
      }),
    });
  });

  it('task thread has null projectId when parent has no project', async () => {
    const ctx = createMockContext();
    mockThreadFindUnique.mockResolvedValue({ projectId: null });

    await setupDelegationTask(ctx, [], makeOptions());

    expect(mockThreadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: null,
      }),
    });
  });

  it('task thread has null projectId when parent thread not found', async () => {
    const ctx = createMockContext();
    mockThreadFindUnique.mockResolvedValue(null);

    await setupDelegationTask(ctx, [], makeOptions());

    expect(mockThreadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: null,
      }),
    });
  });

  it('transaction creates both thread and task atomically', async () => {
    const ctx = createMockContext();

    await setupDelegationTask(ctx, [], makeOptions());

    expect(ctx.db.$transaction).toHaveBeenCalledOnce();
    expect(mockThreadCreate).toHaveBeenCalledOnce();
    expect(mockTaskCreate).toHaveBeenCalledOnce();
  });

  it('returns threadId and taskId from created records', async () => {
    const ctx = createMockContext();
    mockThreadCreate.mockResolvedValue({ id: 'thread-abc' });
    mockTaskCreate.mockResolvedValue({ id: 'task-xyz' });

    const result = await setupDelegationTask(ctx, [], makeOptions());

    expect(result).toEqual({ threadId: 'thread-abc', taskId: 'task-xyz' });
  });

  it('creates thread with kind task and source delegation', async () => {
    const ctx = createMockContext();

    await setupDelegationTask(ctx, [], makeOptions({ prompt: 'Run lint' }));

    expect(mockThreadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'task',
        source: 'delegation',
        parentThreadId: 'parent-thread-1',
        name: 'Task: Run lint',
        status: 'active',
      }),
    });
  });

  it('creates task with default maxIterations when not specified', async () => {
    const ctx = createMockContext();

    await setupDelegationTask(ctx, [], makeOptions());

    expect(mockTaskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        maxIterations: 5,
        currentIteration: 0,
        status: 'pending',
      }),
    });
  });

  it('creates task with custom maxIterations', async () => {
    const ctx = createMockContext();

    await setupDelegationTask(ctx, [], makeOptions({ maxIterations: 10 }));

    expect(mockTaskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        maxIterations: 10,
      }),
    });
  });

  it('broadcasts task:created event', async () => {
    const ctx = createMockContext();
    mockThreadCreate.mockResolvedValue({ id: 'thread-abc' });
    mockTaskCreate.mockResolvedValue({ id: 'task-xyz' });

    await setupDelegationTask(ctx, [], makeOptions());

    expect(ctx.broadcast).toHaveBeenCalledWith('task:created', {
      taskId: 'task-xyz',
      threadId: 'thread-abc',
      parentThreadId: 'parent-thread-1',
      prompt: 'Fix the failing tests',
      maxIterations: 5,
    });
  });

  it('logs task creation with parent thread and max iterations', async () => {
    const ctx = createMockContext();
    mockThreadCreate.mockResolvedValue({ id: 'thread-abc' });
    mockTaskCreate.mockResolvedValue({ id: 'task-xyz' });

    await setupDelegationTask(ctx, [], makeOptions({ maxIterations: 3 }));

    expect(ctx.logger.info).toHaveBeenCalledWith('Delegation: created task task-xyz in thread thread-abc', {
      parentThreadId: 'parent-thread-1',
      maxIterations: 3,
    });
  });
});
