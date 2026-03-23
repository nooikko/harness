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
    reportBackgroundError: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
  }) as unknown as PluginContext;

describe('validator plugin', () => {
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

    // --- Fix 1: Invoke failure → auto-accept ---

    it('auto-accepts when invoker throws (infrastructure failure)', async () => {
      vi.mocked(ctx.invoker.invoke).mockRejectedValueOnce(new Error('Connection timeout'));

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'some result')).resolves.toBeUndefined();

      expect(ctx.logger.error).toHaveBeenCalledWith(
        'Validator: invoke failed, auto-accepting',
        expect.objectContaining({ taskId: 'task-1', threadId: 'thread-1', error: 'Connection timeout' }),
      );
    });

    it('auto-accepts when invoker throws a non-Error value', async () => {
      vi.mocked(ctx.invoker.invoke).mockRejectedValueOnce('string rejection');

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'some result')).resolves.toBeUndefined();

      expect(ctx.logger.error).toHaveBeenCalledWith(
        'Validator: invoke failed, auto-accepting',
        expect.objectContaining({ error: 'string rejection' }),
      );
    });

    // --- Fix 2: Last iteration still validates but suppresses rejection ---

    it('still invokes on final iteration (validates the work)', async () => {
      vi.mocked(ctx.db.orchestratorTask.findUnique).mockResolvedValueOnce({
        currentIteration: 5,
        maxIterations: 5,
        prompt: 'Write a summary',
      } as never);

      vi.mocked(ctx.invoker.invoke).mockResolvedValueOnce({
        output: 'VERDICT: PASS\nGreat work.',
        exitCode: 0,
        durationMs: 100,
        error: undefined,
      });

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'some result')).resolves.toBeUndefined();

      expect(ctx.invoker.invoke).toHaveBeenCalled();
      expect(ctx.logger.info).toHaveBeenCalledWith('Validator: task accepted', expect.objectContaining({ taskId: 'task-1' }));
    });

    it('auto-accepts on final iteration when verdict is FAIL (safety valve)', async () => {
      vi.mocked(ctx.db.orchestratorTask.findUnique).mockResolvedValueOnce({
        currentIteration: 5,
        maxIterations: 5,
        prompt: 'Write a summary',
      } as never);

      vi.mocked(ctx.invoker.invoke).mockResolvedValueOnce({
        output: 'VERDICT: FAIL\nOutput was bad.',
        exitCode: 0,
        durationMs: 100,
        error: undefined,
      });

      const hooks = await plugin.register(ctx);

      // Does NOT throw — safety valve suppresses rejection
      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'some result')).resolves.toBeUndefined();

      expect(ctx.logger.warn).toHaveBeenCalledWith(
        'Validator: task rejected on final iteration, auto-accepting',
        expect.objectContaining({ taskId: 'task-1', feedback: 'Output was bad.' }),
      );
    });

    it('validates with maxIterations=1 instead of skipping entirely', async () => {
      vi.mocked(ctx.db.orchestratorTask.findUnique).mockResolvedValueOnce({
        currentIteration: 1,
        maxIterations: 1,
        prompt: 'Quick task',
      } as never);

      vi.mocked(ctx.invoker.invoke).mockResolvedValueOnce({
        output: 'VERDICT: PASS',
        exitCode: 0,
        durationMs: 50,
        error: undefined,
      });

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'some result')).resolves.toBeUndefined();

      // Opus WAS invoked (unlike the old behavior which skipped entirely)
      expect(ctx.invoker.invoke).toHaveBeenCalled();
    });

    it('auto-accepts when currentIteration exceeds maxIterations and verdict is FAIL', async () => {
      vi.mocked(ctx.db.orchestratorTask.findUnique).mockResolvedValueOnce({
        currentIteration: 7,
        maxIterations: 5,
        prompt: 'Write a summary',
      } as never);

      vi.mocked(ctx.invoker.invoke).mockResolvedValueOnce({
        output: 'VERDICT: FAIL\nToo late.',
        exitCode: 0,
        durationMs: 100,
        error: undefined,
      });

      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', 'some result')).resolves.toBeUndefined();

      expect(ctx.logger.warn).toHaveBeenCalledWith(
        'Validator: task rejected on final iteration, auto-accepting',
        expect.objectContaining({ taskId: 'task-1' }),
      );
    });

    // --- Fix 3: Empty result → skip Opus invocation ---

    it('auto-accepts on empty result without invoking Opus', async () => {
      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', '')).resolves.toBeUndefined();

      expect(ctx.invoker.invoke).not.toHaveBeenCalled();
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        'Validator: empty result, auto-accepting',
        expect.objectContaining({ taskId: 'task-1', threadId: 'thread-1' }),
      );
    });

    it('auto-accepts on whitespace-only result without invoking Opus', async () => {
      const hooks = await plugin.register(ctx);

      await expect(hooks.onTaskComplete?.('thread-1', 'task-1', '   \n  \t  ')).resolves.toBeUndefined();

      expect(ctx.invoker.invoke).not.toHaveBeenCalled();
      expect(ctx.logger.warn).toHaveBeenCalledWith('Validator: empty result, auto-accepting', expect.objectContaining({ taskId: 'task-1' }));
    });

    // --- Fix 4: Configurable model via settings ---

    it('uses model from settings when configured', async () => {
      vi.mocked(ctx.getSettings).mockResolvedValueOnce({ model: 'claude-sonnet-4-6' });

      const hooks = await plugin.register(ctx);

      await hooks.onTaskComplete?.('thread-1', 'task-1', 'some result');

      expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'claude-sonnet-4-6' }));
    });

    it('falls back to default model when settings.model is undefined', async () => {
      vi.mocked(ctx.getSettings).mockResolvedValueOnce({});

      const hooks = await plugin.register(ctx);

      await hooks.onTaskComplete?.('thread-1', 'task-1', 'some result');

      expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'claude-opus-4-6' }));
    });

    it('passes customRubric from settings into the rubric prompt', async () => {
      vi.mocked(ctx.getSettings).mockResolvedValueOnce({ customRubric: 'Is the code correct?' });

      const hooks = await plugin.register(ctx);

      await hooks.onTaskComplete?.('thread-1', 'task-1', 'some result');

      const invokedPrompt = vi.mocked(ctx.invoker.invoke).mock.calls[0]?.[0] as string;
      expect(invokedPrompt).toContain('Is the code correct?');
      expect(invokedPrompt).not.toContain('Q1.');
    });
  });

  describe('onSettingsChange', () => {
    it('reloads settings when pluginName is validator', async () => {
      const ctx = createMockContext();
      const hooks = await plugin.register(ctx);

      // register calls getSettings once
      expect(ctx.getSettings).toHaveBeenCalledTimes(1);

      await hooks.onSettingsChange?.('validator');

      expect(ctx.getSettings).toHaveBeenCalledTimes(2);
    });

    it('ignores settings change for other plugins', async () => {
      const ctx = createMockContext();
      const hooks = await plugin.register(ctx);

      await hooks.onSettingsChange?.('cron');

      // Only the initial call from register, no reload
      expect(ctx.getSettings).toHaveBeenCalledTimes(1);
    });

    it('uses reloaded settings on subsequent onTaskComplete calls', async () => {
      const ctx = createMockContext();
      // Initial registration returns default settings (no model override)
      vi.mocked(ctx.getSettings).mockResolvedValueOnce({});
      const hooks = await plugin.register(ctx);

      // Simulate admin changing model to sonnet
      vi.mocked(ctx.getSettings).mockResolvedValueOnce({ model: 'claude-sonnet-4-6' });
      await hooks.onSettingsChange?.('validator');

      // Now onTaskComplete should use the reloaded model
      await hooks.onTaskComplete?.('thread-1', 'task-1', 'some result');

      expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'claude-sonnet-4-6' }));
    });
  });
});
