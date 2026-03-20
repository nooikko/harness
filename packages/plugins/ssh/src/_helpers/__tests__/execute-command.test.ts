import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeCommand } from '../execute-command';

// Build a fake SSH stream with controllable event emission
type StreamHandler = (...args: unknown[]) => void;

const makeMockStream = () => {
  const handlers = new Map<string, StreamHandler>();
  const stderrHandlers = new Map<string, StreamHandler>();

  const stream = {
    on: vi.fn((event: string, handler: StreamHandler) => {
      handlers.set(event, handler);
      return stream;
    }),
    signal: vi.fn(),
    close: vi.fn(),
    stderr: {
      on: vi.fn((event: string, handler: StreamHandler) => {
        stderrHandlers.set(event, handler);
      }),
    },
    _emit: (event: string, ...args: unknown[]) => {
      handlers.get(event)?.(...args);
    },
    _emitStderr: (event: string, ...args: unknown[]) => {
      stderrHandlers.get(event)?.(...args);
    },
  };
  return stream;
};

const makeMockClient = (stream: ReturnType<typeof makeMockStream>, execError?: Error) => ({
  exec: vi.fn((command: string, callback: (err: Error | undefined, stream: unknown) => void) => {
    if (execError) {
      callback(execError, undefined);
    } else {
      callback(undefined, stream);
    }
  }),
});

describe('executeCommand', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('captures stdout correctly', async () => {
    const stream = makeMockStream();
    const client = makeMockClient(stream);

    const promise = executeCommand({
      client: client as never,
      command: 'echo hello',
      timeoutMs: 5000,
      maxOutputLength: 10000,
    });

    stream._emit('data', Buffer.from('hello world\n'));
    stream._emit('exit', 0);
    stream._emit('close');

    const result = await promise;
    expect(result.stdout).toBe('hello world\n');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
  });

  it('captures stderr correctly', async () => {
    const stream = makeMockStream();
    const client = makeMockClient(stream);

    const promise = executeCommand({
      client: client as never,
      command: 'ls /nonexistent',
      timeoutMs: 5000,
      maxOutputLength: 10000,
    });

    stream._emitStderr('data', Buffer.from('ls: /nonexistent: No such file or directory\n'));
    stream._emit('exit', 1);
    stream._emit('close');

    const result = await promise;
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('ls: /nonexistent: No such file or directory\n');
    expect(result.exitCode).toBe(1);
  });

  it('returns exit code from exit event', async () => {
    const stream = makeMockStream();
    const client = makeMockClient(stream);

    const promise = executeCommand({
      client: client as never,
      command: 'exit 42',
      timeoutMs: 5000,
      maxOutputLength: 10000,
    });

    stream._emit('exit', 42);
    stream._emit('close');

    const result = await promise;
    expect(result.exitCode).toBe(42);
  });

  it('returns null exit code when no exit event fires before close', async () => {
    const stream = makeMockStream();
    const client = makeMockClient(stream);

    const promise = executeCommand({
      client: client as never,
      command: 'some-command',
      timeoutMs: 5000,
      maxOutputLength: 10000,
    });

    // Close without exit event
    stream._emit('close');

    const result = await promise;
    expect(result.exitCode).toBeNull();
  });

  it('truncates stdout at maxOutputLength and appends truncation marker', async () => {
    const stream = makeMockStream();
    const client = makeMockClient(stream);
    const maxLen = 10;

    const promise = executeCommand({
      client: client as never,
      command: 'cat large-file',
      timeoutMs: 5000,
      maxOutputLength: maxLen,
    });

    stream._emit('data', Buffer.from('0123456789EXTRA_DATA'));
    stream._emit('close');

    const result = await promise;
    expect(result.stdout).toContain('0123456789');
    expect(result.stdout).toContain('[Output truncated');
    expect(result.stdout).toContain('bytes omitted]');
  });

  it('truncates stderr at maxOutputLength and appends truncation marker', async () => {
    const stream = makeMockStream();
    const client = makeMockClient(stream);
    const maxLen = 5;

    const promise = executeCommand({
      client: client as never,
      command: 'bad-cmd',
      timeoutMs: 5000,
      maxOutputLength: maxLen,
    });

    stream._emitStderr('data', Buffer.from('ABCDE_OVERFLOW'));
    stream._emit('close');

    const result = await promise;
    expect(result.stderr).toContain('ABCDE');
    expect(result.stderr).toContain('[Output truncated');
    expect(result.stderr).toContain('bytes omitted]');
  });

  it('does not truncate output that is exactly maxOutputLength', async () => {
    const stream = makeMockStream();
    const client = makeMockClient(stream);
    const text = 'exactly';

    const promise = executeCommand({
      client: client as never,
      command: 'cmd',
      timeoutMs: 5000,
      maxOutputLength: text.length,
    });

    stream._emit('data', Buffer.from(text));
    stream._emit('close');

    const result = await promise;
    expect(result.stdout).toBe(text);
  });

  it('sets timedOut flag and signals stream when timeout fires', async () => {
    const stream = makeMockStream();
    const client = makeMockClient(stream);

    const promise = executeCommand({
      client: client as never,
      command: 'sleep 100',
      timeoutMs: 3000,
      maxOutputLength: 10000,
    });

    // Advance fake timers past the timeout
    vi.advanceTimersByTime(3001);

    // After timeout, the stream close event resolves the promise
    stream._emit('close');

    const result = await promise;
    expect(result.timedOut).toBe(true);
    expect(stream.signal).toHaveBeenCalledWith('KILL');
    expect(stream.close).toHaveBeenCalled();
  });

  it('resolves with timedOut false when command finishes before timeout', async () => {
    const stream = makeMockStream();
    const client = makeMockClient(stream);

    const promise = executeCommand({
      client: client as never,
      command: 'fast-cmd',
      timeoutMs: 5000,
      maxOutputLength: 10000,
    });

    stream._emit('exit', 0);
    stream._emit('close');

    const result = await promise;
    expect(result.timedOut).toBe(false);
    expect(stream.signal).not.toHaveBeenCalled();
  });

  it('rejects on exec error', async () => {
    const execError = new Error('Failed to execute command');
    const stream = makeMockStream();
    const client = makeMockClient(stream, execError);

    await expect(
      executeCommand({
        client: client as never,
        command: 'bad-exec',
        timeoutMs: 5000,
        maxOutputLength: 10000,
      }),
    ).rejects.toThrow('Failed to execute command');
  });

  it('concatenates multiple data chunks from stdout', async () => {
    const stream = makeMockStream();
    const client = makeMockClient(stream);

    const promise = executeCommand({
      client: client as never,
      command: 'echo multi',
      timeoutMs: 5000,
      maxOutputLength: 10000,
    });

    stream._emit('data', Buffer.from('chunk1 '));
    stream._emit('data', Buffer.from('chunk2 '));
    stream._emit('data', Buffer.from('chunk3'));
    stream._emit('close');

    const result = await promise;
    expect(result.stdout).toBe('chunk1 chunk2 chunk3');
  });
});
