import type { Logger } from '@harness/logger';
import type { PluginHooks } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runChainHooks } from '../run-chain-hooks';

const makeLogger = (): Logger =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as Logger;

describe('runChainHooks', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = makeLogger();
  });

  it('returns initial prompt when no hooks have onBeforeInvoke', async () => {
    const allHooks: PluginHooks[] = [{}, {}];

    const result = await runChainHooks(allHooks, 'thread-1', 'initial prompt', mockLogger);

    expect(result).toBe('initial prompt');
  });

  it('returns initial prompt when allHooks is empty', async () => {
    const result = await runChainHooks([], 'thread-1', 'initial prompt', mockLogger);

    expect(result).toBe('initial prompt');
  });

  it('chains prompt through multiple hooks', async () => {
    const allHooks: PluginHooks[] = [
      {
        onBeforeInvoke: vi.fn().mockResolvedValue('modified once'),
      },
      {
        onBeforeInvoke: vi.fn().mockResolvedValue('modified twice'),
      },
    ];

    const result = await runChainHooks(allHooks, 'thread-1', 'initial prompt', mockLogger);

    expect(result).toBe('modified twice');
    expect(allHooks[0]!.onBeforeInvoke).toHaveBeenCalledWith('thread-1', 'initial prompt');
    expect(allHooks[1]!.onBeforeInvoke).toHaveBeenCalledWith('thread-1', 'modified once');
  });

  it('catches errors from hooks and continues with current prompt', async () => {
    const allHooks: PluginHooks[] = [
      {
        onBeforeInvoke: vi.fn().mockRejectedValue(new Error('hook blew up')),
      },
      {
        onBeforeInvoke: vi.fn().mockResolvedValue('from second hook'),
      },
    ];

    const result = await runChainHooks(allHooks, 'thread-1', 'initial prompt', mockLogger);

    expect(result).toBe('from second hook');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Hook "onBeforeInvoke" failed: hook blew up',
      expect.objectContaining({ hookName: 'onBeforeInvoke' }),
    );
    expect(allHooks[1]!.onBeforeInvoke).toHaveBeenCalledWith('thread-1', 'initial prompt');
  });

  it('logs error message for non-Error thrown values', async () => {
    const allHooks: PluginHooks[] = [
      {
        onBeforeInvoke: vi.fn().mockRejectedValue('a plain string error'),
      },
    ];

    await runChainHooks(allHooks, 'thread-1', 'initial prompt', mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Hook "onBeforeInvoke" failed: a plain string error',
      expect.objectContaining({ hookName: 'onBeforeInvoke' }),
    );
  });

  it('includes plugin name in error message when names are provided', async () => {
    const allHooks: PluginHooks[] = [
      {
        onBeforeInvoke: vi.fn().mockRejectedValue(new Error('crash')),
      },
    ];

    await runChainHooks(allHooks, 'thread-1', 'initial prompt', mockLogger, ['identity']);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Hook "onBeforeInvoke" failed [plugin=identity]: crash',
      expect.objectContaining({ hookName: 'onBeforeInvoke' }),
    );
  });

  it('passes threadId to each hook', async () => {
    const hook1 = vi.fn().mockResolvedValue('step-1');
    const hook2 = vi.fn().mockResolvedValue('step-2');
    const allHooks: PluginHooks[] = [{ onBeforeInvoke: hook1 }, { onBeforeInvoke: hook2 }];

    await runChainHooks(allHooks, 'my-thread-id', 'prompt', mockLogger);

    expect(hook1).toHaveBeenCalledWith('my-thread-id', expect.any(String));
    expect(hook2).toHaveBeenCalledWith('my-thread-id', expect.any(String));
  });

  it('skips hooks without onBeforeInvoke without affecting the prompt chain', async () => {
    const secondHook = vi.fn().mockResolvedValue('from second hook');
    const allHooks: PluginHooks[] = [{}, { onBeforeInvoke: secondHook }];

    const result = await runChainHooks(allHooks, 'thread-1', 'initial prompt', mockLogger);

    expect(result).toBe('from second hook');
    expect(secondHook).toHaveBeenCalledWith('thread-1', 'initial prompt');
  });

  it('forwards timeoutMs to the underlying runner', async () => {
    vi.useFakeTimers();
    let resolveHook!: (v: string) => void;
    const slowHook = new Promise<string>((r) => {
      resolveHook = r;
    });
    const allHooks: PluginHooks[] = [{ onBeforeInvoke: vi.fn(() => slowHook) }];

    const runPromise = runChainHooks(allHooks, 'thread-1', 'initial prompt', mockLogger, ['identity'], 100);

    await vi.advanceTimersByTimeAsync(101);
    const result = await runPromise;

    expect(result).toBe('initial prompt');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('timed out'),
      expect.objectContaining({ plugin: 'identity', hookName: 'onBeforeInvoke', timeoutMs: 100 }),
    );

    resolveHook('too late');
    vi.useRealTimers();
  });

  it('does not apply timeout when timeoutMs is omitted', async () => {
    const allHooks: PluginHooks[] = [{ onBeforeInvoke: vi.fn().mockResolvedValue('modified') }];

    const result = await runChainHooks(allHooks, 'thread-1', 'initial prompt', mockLogger, ['identity']);

    expect(result).toBe('modified');
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
