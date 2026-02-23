import type { Logger } from '@harness/logger';
import type { PluginHooks } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommandHooks } from '../run-command-hooks';

const makeLogger = (): Logger =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as Logger;

describe('runCommandHooks', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = makeLogger();
  });

  it('returns false when no hooks have onCommand', async () => {
    const allHooks: PluginHooks[] = [{}, {}];

    const result = await runCommandHooks(allHooks, 'thread-1', 'status', '', mockLogger);

    expect(result).toBe(false);
  });

  it('returns false when allHooks is empty', async () => {
    const result = await runCommandHooks([], 'thread-1', 'status', '', mockLogger);

    expect(result).toBe(false);
  });

  it('returns true when a hook handles the command', async () => {
    const allHooks: PluginHooks[] = [
      {
        onCommand: vi.fn().mockResolvedValue(true),
      },
    ];

    const result = await runCommandHooks(allHooks, 'thread-1', 'status', '', mockLogger);

    expect(result).toBe(true);
  });

  it('stops iterating after first hook returns true', async () => {
    const firstHook = vi.fn().mockResolvedValue(true);
    const secondHook = vi.fn().mockResolvedValue(true);
    const allHooks: PluginHooks[] = [{ onCommand: firstHook }, { onCommand: secondHook }];

    const result = await runCommandHooks(allHooks, 'thread-1', 'status', '', mockLogger);

    expect(result).toBe(true);
    expect(firstHook).toHaveBeenCalledTimes(1);
    expect(secondHook).not.toHaveBeenCalled();
  });

  it('continues to next hook when a hook returns false', async () => {
    const firstHook = vi.fn().mockResolvedValue(false);
    const secondHook = vi.fn().mockResolvedValue(true);
    const allHooks: PluginHooks[] = [{ onCommand: firstHook }, { onCommand: secondHook }];

    const result = await runCommandHooks(allHooks, 'thread-1', 'status', '', mockLogger);

    expect(result).toBe(true);
    expect(firstHook).toHaveBeenCalledTimes(1);
    expect(secondHook).toHaveBeenCalledTimes(1);
  });

  it('catches errors from hooks and continues to next hook', async () => {
    const firstHook = vi.fn().mockRejectedValue(new Error('handler crashed'));
    const secondHook = vi.fn().mockResolvedValue(true);
    const allHooks: PluginHooks[] = [{ onCommand: firstHook }, { onCommand: secondHook }];

    const result = await runCommandHooks(allHooks, 'thread-1', 'ping', 'arg1', mockLogger);

    expect(result).toBe(true);
    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onCommand(/ping)" threw: handler crashed');
    expect(secondHook).toHaveBeenCalledTimes(1);
  });

  it('logs error with command name for non-Error thrown values', async () => {
    const allHooks: PluginHooks[] = [
      {
        onCommand: vi.fn().mockRejectedValue('a plain string error'),
      },
    ];

    await runCommandHooks(allHooks, 'thread-1', 'ping', '', mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onCommand(/ping)" threw: a plain string error');
  });

  it('returns false when no hook handles the command', async () => {
    const allHooks: PluginHooks[] = [{ onCommand: vi.fn().mockResolvedValue(false) }, { onCommand: vi.fn().mockResolvedValue(false) }];

    const result = await runCommandHooks(allHooks, 'thread-1', 'unknown', '', mockLogger);

    expect(result).toBe(false);
  });

  it('passes threadId, command, and args to each hook', async () => {
    const hook = vi.fn().mockResolvedValue(false);
    const allHooks: PluginHooks[] = [{ onCommand: hook }];

    await runCommandHooks(allHooks, 'my-thread-id', 'deploy', 'staging', mockLogger);

    expect(hook).toHaveBeenCalledWith('my-thread-id', 'deploy', 'staging');
  });

  it('skips hooks without onCommand without error', async () => {
    const secondHook = vi.fn().mockResolvedValue(true);
    const allHooks: PluginHooks[] = [{}, { onCommand: secondHook }];

    const result = await runCommandHooks(allHooks, 'thread-1', 'status', '', mockLogger);

    expect(result).toBe(true);
    expect(secondHook).toHaveBeenCalledTimes(1);
  });
});
