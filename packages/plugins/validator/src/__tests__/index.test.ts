import type { InvokeResult, PluginContext } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { plugin } from '../index';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () =>
  ({
    db: {
      orchestratorTask: {
        findUnique: vi.fn().mockResolvedValue({
          currentIteration: 1,
          maxIterations: 5,
          prompt: 'Write a summary',
        }),
      },
    },
    invoker: {
      invoke: vi.fn().mockResolvedValue({
        output: 'VERDICT: PASS\nLooks good.',
        exitCode: 0,
        durationMs: 100,
        error: undefined,
      } satisfies InvokeResult),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    config: {} as never,
    sendToThread: vi.fn(),
    broadcast: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({}),
    notifySettingsChange: vi.fn().mockResolvedValue(undefined),
    reportStatus: vi.fn(),
  }) as unknown as PluginContext;

describe('validator plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('validator');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers and returns onTaskComplete hook', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks.onTaskComplete).toBeDefined();
    expect(typeof hooks.onTaskComplete).toBe('function');
  });

  describe('onTaskComplete', () => {
    let ctx: PluginContext;

    beforeEach(() => {
      ctx = createMockContext();
    });

    it('accepts without throwing when task is not found', async () => {
      vi.mocked(ctx.db.orchestratorTask.findUnique).mockResolvedValueOnce(null);

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'some result')).resolves.toBeUndefined();

      expect(ctx.invoker.invoke).not.toHaveBeenCalled();
    });

    it('accepts on final iteration without invoking (safety valve)', async () => {
      vi.mocked(ctx.db.orchestratorTask.findUnique).mockResolvedValueOnce({
        currentIteration: 5,
        maxIterations: 5,
        prompt: 'Write a summary',
      } as never);

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'some result')).resolves.toBeUndefined();

      expect(ctx.invoker.invoke).not.toHaveBeenCalled();
    });

    it('accepts when currentIteration exceeds maxIterations', async () => {
      vi.mocked(ctx.db.orchestratorTask.findUnique).mockResolvedValueOnce({
        currentIteration: 7,
        maxIterations: 5,
        prompt: 'Write a summary',
      } as never);

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'some result')).resolves.toBeUndefined();

      expect(ctx.invoker.invoke).not.toHaveBeenCalled();
    });

    it('invokes opus and accepts without throwing on PASS verdict', async () => {
      vi.mocked(ctx.invoker.invoke).mockResolvedValueOnce({
        output: 'VERDICT: PASS\nLooks good.',
        exitCode: 0,
        durationMs: 100,
        error: undefined,
      });

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'The output is complete.')).resolves.toBeUndefined();

      expect(ctx.invoker.invoke).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ model: 'claude-opus-4-6', threadId: 'validator-thread-1' }),
      );
      expect(ctx.logger.info).toHaveBeenCalledWith('Validator: task accepted', expect.objectContaining({ taskId: 'task-1', threadId: 'thread-1' }));
    });

    it('invokes opus with correct threadId and taskId on FAIL verdict', async () => {
      vi.mocked(ctx.invoker.invoke).mockResolvedValueOnce({
        output: 'VERDICT: FAIL\nThe output was incomplete.',
        exitCode: 0,
        durationMs: 100,
        error: undefined,
      });

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-2', 'task-99', 'short answer')).rejects.toThrow('The output was incomplete.');

      expect(ctx.invoker.invoke).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ model: 'claude-opus-4-6', threadId: 'validator-thread-2' }),
      );
    });

    it('throws Error with the feedback message on FAIL verdict', async () => {
      vi.mocked(ctx.invoker.invoke).mockResolvedValueOnce({
        output: 'VERDICT: FAIL\nThe output was incomplete.',
        exitCode: 0,
        durationMs: 100,
        error: undefined,
      });

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'some result')).rejects.toThrow('The output was incomplete.');

      expect(ctx.logger.warn).toHaveBeenCalledWith(
        'Validator: task rejected',
        expect.objectContaining({ taskId: 'task-1', threadId: 'thread-1', feedback: 'The output was incomplete.' }),
      );
    });

    it('trims multi-line feedback from FAIL verdict', async () => {
      vi.mocked(ctx.invoker.invoke).mockResolvedValueOnce({
        output: 'VERDICT: FAIL\nLine one.\nLine two.\nLine three.',
        exitCode: 0,
        durationMs: 100,
        error: undefined,
      });

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'some result')).rejects.toThrow('Line one.\nLine two.\nLine three.');
    });

    it('logs warning and accepts without throwing on unknown verdict', async () => {
      vi.mocked(ctx.invoker.invoke).mockResolvedValueOnce({
        output: 'No verdict here',
        exitCode: 0,
        durationMs: 100,
        error: undefined,
      });

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'some result')).resolves.toBeUndefined();

      expect(ctx.logger.warn).toHaveBeenCalledWith(
        'Validator: could not parse verdict, auto-accepting',
        expect.objectContaining({ taskId: 'task-1', threadId: 'thread-1' }),
      );
    });

    it('does not call logger.warn when verdict is PASS', async () => {
      const hooks = await plugin.register(ctx);

      await hooks.onTaskComplete?.('thread-1', 'task-1', 'some result');

      expect(ctx.logger.warn).not.toHaveBeenCalled();
    });

    it('queries db with the correct taskId', async () => {
      const hooks = await plugin.register(ctx);

      await hooks.onTaskComplete?.('thread-1', 'task-abc-123', 'some result');

      expect(ctx.db.orchestratorTask.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-abc-123' },
        select: { currentIteration: true, maxIterations: true, prompt: true },
      });
    });
  });
});
