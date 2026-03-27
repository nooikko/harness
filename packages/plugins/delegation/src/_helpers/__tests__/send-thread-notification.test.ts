import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { sendThreadNotification, type ThreadNotificationInput } from '../send-thread-notification';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () =>
  ({
    db: { message: { create: vi.fn().mockResolvedValue({}) } } as never,
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
    sendToThread: vi.fn().mockResolvedValue(undefined),
    broadcast: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({}),
    notifySettingsChange: vi.fn().mockResolvedValue(undefined),
    reportStatus: vi.fn(),
    reportBackgroundError: vi.fn(),
    runBackground: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
  }) as unknown as PluginContext;

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
  it('sends completed notification to parent thread via sendToThread', async () => {
    const ctx = createMockContext();
    const input = makeInput({ result: 'Full result output from sub-agent' });

    await sendThreadNotification(ctx, input);

    expect(ctx.sendToThread).toHaveBeenCalledWith('parent-thread-1', expect.stringContaining('Delegation task completed in 2 iteration(s).'));
    expect(ctx.sendToThread).toHaveBeenCalledWith('parent-thread-1', expect.stringContaining('Full result output from sub-agent'));
  });

  it('sends failed notification to parent thread via sendToThread', async () => {
    const ctx = createMockContext();
    const input = makeInput({
      status: 'failed',
      summary: 'Max iterations exhausted',
      iterations: 5,
    });

    await sendThreadNotification(ctx, input);

    expect(ctx.sendToThread).toHaveBeenCalledWith('parent-thread-1', expect.stringContaining('Delegation task failed after 5 iteration(s).'));
    expect(ctx.sendToThread).toHaveBeenCalledWith('parent-thread-1', expect.stringContaining('Max iterations exhausted'));
  });

  it('includes re-delegation guidance in completed notification', async () => {
    const ctx = createMockContext();
    const input = makeInput({ result: 'Some result' });

    await sendThreadNotification(ctx, input);

    const content = (ctx.sendToThread as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(content).toContain('Review the result above. If it meets the original requirements, proceed.');
  });

  it('includes re-delegation guidance in failed notification', async () => {
    const ctx = createMockContext();
    const input = makeInput({ status: 'failed', summary: 'Timed out' });

    await sendThreadNotification(ctx, input);

    const content = (ctx.sendToThread as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(content).toContain('Consider re-delegating with adjusted requirements or a different approach.');
  });

  it('falls back to summary when result is not provided for completed', async () => {
    const ctx = createMockContext();
    const input = makeInput();

    await sendThreadNotification(ctx, input);

    const content = (ctx.sendToThread as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(content).toContain('All tests pass and lint is clean.');
  });

  it('truncates result to 2000 characters', async () => {
    const ctx = createMockContext();
    const longResult = 'A'.repeat(3000);
    const input = makeInput({ result: longResult });

    await sendThreadNotification(ctx, input);

    const content = (ctx.sendToThread as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    // The result portion should be truncated
    const resultSection = content.split('## Result\n\n')[1] ?? '';
    const resultText = resultSection.split('\n\nReview the result above')[0] ?? '';
    expect(resultText.length).toBe(2000);
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

  it('logs error and continues when sendToThread rejects', async () => {
    const ctx = createMockContext();
    (ctx.sendToThread as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Parent thread deleted'));

    const input = makeInput();

    // Should not throw — sendToThread failure is caught and logged
    await sendThreadNotification(ctx, input);

    expect(ctx.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('sendToThread failed'),
      expect.objectContaining({ error: 'Parent thread deleted' }),
    );

    // broadcast should still fire
    expect(ctx.broadcast).toHaveBeenCalledWith('thread:notification', expect.any(Object));
  });

  it('propagates error when broadcast rejects', async () => {
    const ctx = createMockContext();
    (ctx.broadcast as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('WS down'));

    const input = makeInput();

    await expect(sendThreadNotification(ctx, input)).rejects.toThrow('WS down');
  });
});
