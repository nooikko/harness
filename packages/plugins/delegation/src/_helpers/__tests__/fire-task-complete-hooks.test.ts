import type { PluginContext, PluginHooks } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { fireTaskCompleteHooks } from '../fire-task-complete-hooks';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () => ({
  db: {} as never,
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
    disabledPlugins: [],
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  sendToThread: vi.fn(),
  broadcast: vi.fn(),
});

describe('fireTaskCompleteHooks', () => {
  it('returns accepted true when all hooks pass', async () => {
    const ctx = createMockContext();
    const onTaskComplete = vi.fn().mockResolvedValue(undefined);
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    const outcome = await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'Task output', ctx);

    expect(outcome.accepted).toBe(true);
    expect(outcome.feedback).toBeUndefined();
    expect(onTaskComplete).toHaveBeenCalledWith('thread-1', 'task-1', 'Task output');
  });

  it('returns accepted true with no hooks', async () => {
    const ctx = createMockContext();
    const hooks: PluginHooks[] = [];

    const outcome = await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'Task output', ctx);

    expect(outcome.accepted).toBe(true);
    expect(outcome.feedback).toBeUndefined();
  });

  it('returns accepted false with feedback when a hook throws an Error', async () => {
    const ctx = createMockContext();
    const onTaskComplete = vi.fn().mockRejectedValue(new Error('Code quality check failed'));
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    const outcome = await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'Bad output', ctx);

    expect(outcome.accepted).toBe(false);
    expect(outcome.feedback).toBe('Validation hook error: Code quality check failed');
  });

  it('logs the error when a hook throws', async () => {
    const ctx = createMockContext();
    const onTaskComplete = vi.fn().mockRejectedValue(new Error('Lint failed'));
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'output', ctx);

    expect(ctx.logger.error).toHaveBeenCalledWith('Hook "onTaskComplete" threw: Lint failed');
  });

  it('iterates through multiple hooks in order', async () => {
    const ctx = createMockContext();
    const callOrder: number[] = [];
    const hook1 = vi.fn().mockImplementation(async () => {
      callOrder.push(1);
    });
    const hook2 = vi.fn().mockImplementation(async () => {
      callOrder.push(2);
    });
    const hook3 = vi.fn().mockImplementation(async () => {
      callOrder.push(3);
    });
    const hooks: PluginHooks[] = [{ onTaskComplete: hook1 }, { onTaskComplete: hook2 }, { onTaskComplete: hook3 }];

    const outcome = await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'output', ctx);

    expect(outcome.accepted).toBe(true);
    expect(callOrder).toEqual([1, 2, 3]);
    expect(hook1).toHaveBeenCalledTimes(1);
    expect(hook2).toHaveBeenCalledTimes(1);
    expect(hook3).toHaveBeenCalledTimes(1);
  });

  it('stops at the first hook that throws and does not call subsequent hooks', async () => {
    const ctx = createMockContext();
    const hook1 = vi.fn().mockResolvedValue(undefined);
    const hook2 = vi.fn().mockRejectedValue(new Error('Validation failed'));
    const hook3 = vi.fn().mockResolvedValue(undefined);
    const hooks: PluginHooks[] = [{ onTaskComplete: hook1 }, { onTaskComplete: hook2 }, { onTaskComplete: hook3 }];

    const outcome = await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'output', ctx);

    expect(outcome.accepted).toBe(false);
    expect(hook1).toHaveBeenCalledTimes(1);
    expect(hook2).toHaveBeenCalledTimes(1);
    expect(hook3).not.toHaveBeenCalled();
  });

  it('skips hooks that do not define onTaskComplete', async () => {
    const ctx = createMockContext();
    const hook2 = vi.fn().mockResolvedValue(undefined);
    const hooks: PluginHooks[] = [{}, { onTaskComplete: hook2 }, { onTaskCreate: vi.fn() }];

    const outcome = await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'output', ctx);

    expect(outcome.accepted).toBe(true);
    expect(hook2).toHaveBeenCalledTimes(1);
  });

  it('handles non-Error thrown values as feedback string', async () => {
    const ctx = createMockContext();
    const onTaskComplete = vi.fn().mockRejectedValue('string rejection');
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    const outcome = await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'output', ctx);

    expect(outcome.accepted).toBe(false);
    expect(outcome.feedback).toBe('Validation hook error: string rejection');
    expect(ctx.logger.error).toHaveBeenCalledWith('Hook "onTaskComplete" threw: string rejection');
  });

  it('handles numeric thrown values', async () => {
    const ctx = createMockContext();
    const onTaskComplete = vi.fn().mockRejectedValue(42);
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    const outcome = await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'output', ctx);

    expect(outcome.accepted).toBe(false);
    expect(outcome.feedback).toBe('Validation hook error: 42');
    expect(ctx.logger.error).toHaveBeenCalledWith('Hook "onTaskComplete" threw: 42');
  });

  it('handles null thrown values', async () => {
    const ctx = createMockContext();
    const onTaskComplete = vi.fn().mockRejectedValue(null);
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    const outcome = await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'output', ctx);

    expect(outcome.accepted).toBe(false);
    expect(outcome.feedback).toBe('Validation hook error: null');
  });

  it('handles undefined thrown values', async () => {
    const ctx = createMockContext();
    const onTaskComplete = vi.fn().mockRejectedValue(undefined);
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    const outcome = await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'output', ctx);

    expect(outcome.accepted).toBe(false);
    expect(outcome.feedback).toBe('Validation hook error: undefined');
  });

  it('passes correct arguments to each hook', async () => {
    const ctx = createMockContext();
    const onTaskComplete = vi.fn().mockResolvedValue(undefined);
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    await fireTaskCompleteHooks(hooks, 'thread-abc', 'task-xyz', 'The sub-agent result output', ctx);

    expect(onTaskComplete).toHaveBeenCalledWith('thread-abc', 'task-xyz', 'The sub-agent result output');
  });

  it('handles Error with empty message', async () => {
    const ctx = createMockContext();
    const onTaskComplete = vi.fn().mockRejectedValue(new Error(''));
    const hooks: PluginHooks[] = [{ onTaskComplete }];

    const outcome = await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'output', ctx);

    expect(outcome.accepted).toBe(false);
    expect(outcome.feedback).toBe('Validation hook error: ');
  });

  it('returns accepted true when all hooks have no onTaskComplete', async () => {
    const ctx = createMockContext();
    const hooks: PluginHooks[] = [{ onTaskCreate: vi.fn() }, { onTaskFailed: vi.fn() }, { onMessage: vi.fn() }];

    const outcome = await fireTaskCompleteHooks(hooks, 'thread-1', 'task-1', 'output', ctx);

    expect(outcome.accepted).toBe(true);
    expect(ctx.logger.error).not.toHaveBeenCalled();
  });
});
