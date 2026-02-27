import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { sendThreadNotification, type ThreadNotificationInput } from '../send-thread-notification';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () => ({
  db: {
    message: {
      create: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    },
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
});

type MakeInput = (overrides?: Partial<ThreadNotificationInput>) => ThreadNotificationInput;

const makeInput: MakeInput = (overrides) => ({
  parentThreadId: 'parent-thread-1',
  taskThreadId: 'task-thread-1',
  taskId: 'task-1',
  status: 'completed',
  summary: 'All tests pass and lint is clean.',
  iterations: 2,
  ...overrides,
});

describe('sendThreadNotification', () => {
  it('creates a system message in the parent thread with cross-thread metadata', async () => {
    const ctx = createMockContext();
    const input = makeInput();

    await sendThreadNotification(ctx, input);

    expect(ctx.db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: 'parent-thread-1',
        role: 'system',
        content: 'Task completed after 2 iteration(s): All tests pass and lint is clean.',
        metadata: {
          type: 'cross-thread-notification',
          sourceThreadId: 'task-thread-1',
          taskId: 'task-1',
          status: 'completed',
          iterations: 2,
        },
      },
    });
  });

  it('creates a failed notification with correct content', async () => {
    const ctx = createMockContext();
    const input = makeInput({ status: 'failed', summary: 'Max iterations exhausted', iterations: 5 });

    await sendThreadNotification(ctx, input);

    expect(ctx.db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: 'parent-thread-1',
        role: 'system',
        content: 'Task failed after 5 iteration(s): Max iterations exhausted',
        metadata: {
          type: 'cross-thread-notification',
          sourceThreadId: 'task-thread-1',
          taskId: 'task-1',
          status: 'failed',
          iterations: 5,
        },
      },
    });
  });

  it('logs the notification event', async () => {
    const ctx = createMockContext();
    const input = makeInput();

    await sendThreadNotification(ctx, input);

    expect(ctx.logger.info).toHaveBeenCalledWith('Delegation: sent completed notification to thread parent-thread-1 for task task-1');
  });

  it('logs failed status label for failed notifications', async () => {
    const ctx = createMockContext();
    const input = makeInput({ status: 'failed' });

    await sendThreadNotification(ctx, input);

    expect(ctx.logger.info).toHaveBeenCalledWith('Delegation: sent failed notification to thread parent-thread-1 for task task-1');
  });

  it('broadcasts the thread:notification event', async () => {
    const ctx = createMockContext();
    const input = makeInput();

    await sendThreadNotification(ctx, input);

    expect(ctx.broadcast).toHaveBeenCalledWith('thread:notification', {
      parentThreadId: 'parent-thread-1',
      taskThreadId: 'task-thread-1',
      taskId: 'task-1',
      status: 'completed',
    });
  });

  it('handles single iteration in content text', async () => {
    const ctx = createMockContext();
    const input = makeInput({ iterations: 1 });

    await sendThreadNotification(ctx, input);

    expect(ctx.db.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: 'Task completed after 1 iteration(s): All tests pass and lint is clean.',
        }),
      }),
    );
  });

  it('preserves all metadata fields in the message', async () => {
    const ctx = createMockContext();
    const input = makeInput({ taskId: 'task-xyz-123', taskThreadId: 'thread-abc', iterations: 3 });

    await sendThreadNotification(ctx, input);

    const callArgs = (ctx.db.message.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArgs?.data?.metadata).toEqual({
      type: 'cross-thread-notification',
      sourceThreadId: 'thread-abc',
      taskId: 'task-xyz-123',
      status: 'completed',
      iterations: 3,
    });
  });
});
