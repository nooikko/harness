import type { PrismaClient } from '@harness/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logCommand } from '../log-command';

const makeMockDb = () =>
  ({
    sshCommandLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  }) as unknown as PrismaClient;

describe('logCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an SshCommandLog record with correct fields', async () => {
    const db = makeMockDb();

    logCommand(db, {
      hostId: 'host-1',
      command: 'ls -la',
      exitCode: 0,
      stdout: 'total 8\ndrwxr-xr-x 2 user user 4096 Jan  1 00:00 .',
      stderr: '',
      duration: 123,
      threadId: 'thread-abc',
      agentId: 'agent-xyz',
    });

    // Fire-and-forget — wait for the microtask queue to flush
    await new Promise((resolve) => setImmediate(resolve));

    expect(db.sshCommandLog.create).toHaveBeenCalledWith({
      data: {
        hostId: 'host-1',
        command: 'ls -la',
        exitCode: 0,
        stdout: 'total 8\ndrwxr-xr-x 2 user user 4096 Jan  1 00:00 .',
        stderr: null,
        duration: 123,
        threadId: 'thread-abc',
        agentId: 'agent-xyz',
      },
    });
  });

  it('truncates stdout to 500 characters', async () => {
    const db = makeMockDb();
    const longStdout = 'a'.repeat(600);

    logCommand(db, {
      hostId: 'host-1',
      command: 'cat big-file',
      exitCode: 0,
      stdout: longStdout,
      stderr: '',
      duration: 50,
      threadId: undefined,
      agentId: undefined,
    });

    await new Promise((resolve) => setImmediate(resolve));

    const callArg = (db.sshCommandLog.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg.data.stdout).toHaveLength(500);
    expect(callArg.data.stdout).toBe('a'.repeat(500));
  });

  it('truncates stderr to 500 characters', async () => {
    const db = makeMockDb();
    const longStderr = 'e'.repeat(700);

    logCommand(db, {
      hostId: 'host-1',
      command: 'bad-cmd',
      exitCode: 1,
      stdout: '',
      stderr: longStderr,
      duration: 10,
      threadId: undefined,
      agentId: undefined,
    });

    await new Promise((resolve) => setImmediate(resolve));

    const callArg = (db.sshCommandLog.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg.data.stderr).toHaveLength(500);
    expect(callArg.data.stderr).toBe('e'.repeat(500));
  });

  it('stores null for empty stdout', async () => {
    const db = makeMockDb();

    logCommand(db, {
      hostId: 'host-1',
      command: 'true',
      exitCode: 0,
      stdout: '',
      stderr: '',
      duration: 5,
      threadId: undefined,
      agentId: undefined,
    });

    await new Promise((resolve) => setImmediate(resolve));

    const callArg = (db.sshCommandLog.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg.data.stdout).toBeNull();
    expect(callArg.data.stderr).toBeNull();
  });

  it('stores null for threadId and agentId when undefined', async () => {
    const db = makeMockDb();

    logCommand(db, {
      hostId: 'host-1',
      command: 'echo hi',
      exitCode: 0,
      stdout: 'hi',
      stderr: '',
      duration: 8,
      threadId: undefined,
      agentId: undefined,
    });

    await new Promise((resolve) => setImmediate(resolve));

    const callArg = (db.sshCommandLog.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg.data.threadId).toBeNull();
    expect(callArg.data.agentId).toBeNull();
  });

  it('does not throw when db.create rejects (fire-and-forget swallows errors)', async () => {
    const db = makeMockDb();
    (db.sshCommandLog.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'));

    // Should not throw synchronously
    expect(() =>
      logCommand(db, {
        hostId: 'host-1',
        command: 'cmd',
        exitCode: 0,
        stdout: 'output',
        stderr: '',
        duration: 10,
        threadId: undefined,
        agentId: undefined,
      }),
    ).not.toThrow();

    // Wait and verify no unhandled rejection was surfaced
    await new Promise((resolve) => setImmediate(resolve));
    // If we get here without throwing, the error was swallowed as expected
    expect(true).toBe(true);
  });

  it('does not throw synchronously (fire-and-forget returns void)', () => {
    const db = makeMockDb();
    const returnValue = logCommand(db, {
      hostId: 'host-1',
      command: 'ls',
      exitCode: 0,
      stdout: 'output',
      stderr: '',
      duration: 15,
      threadId: 't-1',
      agentId: 'a-1',
    });
    expect(returnValue).toBeUndefined();
  });
});
