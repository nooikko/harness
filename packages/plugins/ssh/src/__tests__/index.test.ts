import type { PrismaClient } from '@harness/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted runs before vi.mock hoisting, making these available inside factory functions
const { mockPool, mockExecuteCommand, mockResolveHost, mockLogCommand } = vi.hoisted(() => ({
  mockPool: {
    getConnection: vi.fn(),
    release: vi.fn(),
    evict: vi.fn(),
    releaseAll: vi.fn(),
    getPoolSize: vi.fn().mockReturnValue(0),
  },
  mockExecuteCommand: vi.fn(),
  mockResolveHost: vi.fn(),
  mockLogCommand: vi.fn(),
}));

vi.mock('ssh2', () => ({
  Client: class {
    on = vi.fn().mockReturnThis();
    connect = vi.fn();
    end = vi.fn();
    exec = vi.fn();
  },
}));

vi.mock('@harness/plugin-contract', () => ({
  decryptValue: vi.fn((ciphertext: string) => `decrypted:${ciphertext}`),
  encryptValue: vi.fn((plaintext: string) => `encrypted:${plaintext}`),
  createSettingsSchema: vi.fn((schema: unknown) => ({
    toFieldArray: () =>
      Object.entries(schema as Record<string, { type: string; label: string; default: unknown }>).map(([name, def]) => ({
        name,
        ...def,
      })),
  })),
}));

vi.mock('../_helpers/connection-pool', () => ({
  createConnectionPool: vi.fn(() => mockPool),
}));

vi.mock('../_helpers/execute-command', () => ({
  executeCommand: mockExecuteCommand,
}));

vi.mock('../_helpers/resolve-host', () => ({
  resolveHost: mockResolveHost,
}));

vi.mock('../_helpers/log-command', () => ({
  logCommand: mockLogCommand,
}));

vi.mock('../env', () => ({
  loadSshEnv: vi.fn(() => ({ encryptionKey: 'test-encryption-key' })),
}));

import { plugin } from '../index';

const makeMockDb = () =>
  ({
    sshHost: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    sshCommandLog: {
      create: vi.fn(),
    },
    thread: {
      findUnique: vi.fn(),
    },
  }) as unknown as PrismaClient;

const makeMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

const makeMockCtx = (db: PrismaClient, overrides: Record<string, unknown> = {}) => ({
  db,
  logger: makeMockLogger(),
  getSettings: vi.fn().mockResolvedValue({
    defaultTimeout: 30,
    maxOutputLength: 50000,
    logCommands: true,
  }),
  reportStatus: vi.fn(),
  broadcast: vi.fn(),
  sendToThread: vi.fn(),
  notifySettingsChange: vi.fn(),
  invoker: { invoke: vi.fn() },
  config: {
    port: 3000,
    claudeModel: 'haiku',
    claudeTimeout: 300,
    timezone: 'UTC',
  },
  ...overrides,
});

const makeMockMeta = (threadId = 'thread-1') => ({
  threadId,
  taskId: undefined,
  traceId: 'trace-1',
});

const makeResolvedHost = (overrides: Record<string, unknown> = {}) => ({
  id: 'host-1',
  name: 'my-server',
  hostname: '192.168.1.100',
  port: 22,
  username: 'admin',
  authMethod: 'key',
  privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
  fingerprint: 'abc123fingerprint',
  enabled: true,
  ...overrides,
});

describe('SSH plugin', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockPool.getConnection.mockReset();
    mockPool.release.mockReset();
    mockPool.releaseAll.mockReset();
    mockPool.getPoolSize.mockReset();
    mockPool.getPoolSize.mockReturnValue(0);
    mockExecuteCommand.mockReset();
    mockResolveHost.mockReset();
    mockLogCommand.mockReset();

    // vi.clearAllMocks() clears mock return values — re-establish the createConnectionPool return
    const { createConnectionPool } = await import('../_helpers/connection-pool');
    (createConnectionPool as ReturnType<typeof vi.fn>).mockReturnValue(mockPool);

    // Re-establish env mock to return a valid encryption key by default
    const { loadSshEnv } = await import('../env');
    (loadSshEnv as ReturnType<typeof vi.fn>).mockReturnValue({ encryptionKey: 'test-encryption-key' });
  });

  describe('plugin metadata', () => {
    it('exports correct plugin name', () => {
      expect(plugin.name).toBe('ssh');
    });

    it('exports correct plugin version', () => {
      expect(plugin.version).toBe('1.0.0');
    });

    it('exports a settingsSchema', () => {
      expect(plugin.settingsSchema).toBeDefined();
    });

    it('has 5 tools', () => {
      expect(plugin.tools).toHaveLength(5);
    });

    it('tool names are exec, list_hosts, add_host, remove_host, test_connection', () => {
      const names = plugin.tools?.map((t) => t.name) ?? [];
      expect(names).toContain('exec');
      expect(names).toContain('list_hosts');
      expect(names).toContain('add_host');
      expect(names).toContain('remove_host');
      expect(names).toContain('test_connection');
    });
  });

  describe('register', () => {
    it('returns hooks object with onSettingsChange', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      const hooks = await plugin.register!(ctx as never);

      expect(hooks).toMatchObject({ onSettingsChange: expect.any(Function) });
    });

    it('calls getSettings with settingsSchema', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      await plugin.register!(ctx as never);

      expect(ctx.getSettings).toHaveBeenCalledWith(plugin.settingsSchema);
    });

    it('reports degraded status when encryption key is not set', async () => {
      const { loadSshEnv } = await import('../env');
      (loadSshEnv as ReturnType<typeof vi.fn>).mockReturnValueOnce({ encryptionKey: undefined });

      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      await plugin.register!(ctx as never);

      expect(ctx.reportStatus).toHaveBeenCalledWith('degraded', 'HARNESS_ENCRYPTION_KEY not set — cannot store SSH keys securely');
    });

    it('does not report degraded when encryption key is set', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      await plugin.register!(ctx as never);

      expect(ctx.reportStatus).not.toHaveBeenCalled();
    });

    it('logs info message on register', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      await plugin.register!(ctx as never);

      expect(ctx.logger.info).toHaveBeenCalledWith('SSH plugin registered');
    });
  });

  describe('start', () => {
    it('logs info message on start', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      await plugin.start!(ctx as never);

      expect(ctx.logger.info).toHaveBeenCalledWith('SSH plugin started');
    });
  });

  describe('stop', () => {
    it('calls releaseAll on the pool when pool exists', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      // Initialize pool by running register first
      await plugin.register!(ctx as never);
      await plugin.stop!(ctx as never);

      expect(mockPool.releaseAll).toHaveBeenCalledTimes(1);
    });

    it('logs info message on stop', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      await plugin.register!(ctx as never);
      await plugin.stop!(ctx as never);

      expect(ctx.logger.info).toHaveBeenCalledWith('SSH plugin stopped');
    });
  });

  describe('exec tool', () => {
    const getExecTool = () => plugin.tools?.find((t) => t.name === 'exec');

    it('returns formatted output on success', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      await plugin.register!(ctx as never);

      const host = makeResolvedHost();
      mockResolveHost.mockResolvedValue(host);
      mockPool.getConnection.mockResolvedValue({ exec: vi.fn() });
      mockExecuteCommand.mockResolvedValue({
        stdout: 'hello world',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });
      (db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ agentId: 'agent-1' });

      const result = await getExecTool()!.handler(ctx as never, { host: 'my-server', command: 'echo hello' }, makeMockMeta());

      expect(result).toContain('Exit code: 0');
      expect(result).toContain('STDOUT:');
      expect(result).toContain('hello world');
    });

    it('includes TIMED OUT in result when command times out', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      await plugin.register!(ctx as never);

      const host = makeResolvedHost();
      mockResolveHost.mockResolvedValue(host);
      mockPool.getConnection.mockResolvedValue({ exec: vi.fn() });
      mockExecuteCommand.mockResolvedValue({
        stdout: 'partial',
        stderr: '',
        exitCode: null,
        timedOut: true,
      });
      (db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ agentId: 'agent-1' });

      const result = await getExecTool()!.handler(ctx as never, { host: 'my-server', command: 'sleep 100' }, makeMockMeta());

      expect(result).toContain('[TIMED OUT]');
    });

    it('returns error string when pool is not initialized', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      // Skip register so pool module-level variable stays null

      const host = makeResolvedHost();
      mockResolveHost.mockResolvedValue(host);

      // Stop any previous registration to reset pool to null
      await plugin.stop!(ctx as never);

      const result = await getExecTool()!.handler(ctx as never, { host: 'my-server', command: 'ls' }, makeMockMeta());

      expect(result).toBe('Error: SSH plugin not initialized');
    });

    it('returns error string when resolveHost throws', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      await plugin.register!(ctx as never);

      mockResolveHost.mockRejectedValue(new Error('SSH host not found: ghost'));

      const result = await getExecTool()!.handler(ctx as never, { host: 'ghost', command: 'ls' }, makeMockMeta());

      expect(result).toContain('SSH host not found: ghost');
    });

    it('calls logCommand when logCommands setting is true', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      await plugin.register!(ctx as never);

      const host = makeResolvedHost();
      mockResolveHost.mockResolvedValue(host);
      mockPool.getConnection.mockResolvedValue({ exec: vi.fn() });
      mockExecuteCommand.mockResolvedValue({
        stdout: 'output',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      });
      (db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ agentId: 'agent-abc' });

      await getExecTool()!.handler(ctx as never, { host: 'my-server', command: 'ls' }, makeMockMeta('thread-123'));

      expect(mockLogCommand).toHaveBeenCalledWith(
        db,
        expect.objectContaining({
          hostId: 'host-1',
          command: 'ls',
          threadId: 'thread-123',
          agentId: 'agent-abc',
        }),
        ctx.logger,
      );
    });

    it('includes stderr in result when present', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      await plugin.register!(ctx as never);

      const host = makeResolvedHost();
      mockResolveHost.mockResolvedValue(host);
      mockPool.getConnection.mockResolvedValue({ exec: vi.fn() });
      mockExecuteCommand.mockResolvedValue({
        stdout: '',
        stderr: 'command not found',
        exitCode: 127,
        timedOut: false,
      });
      (db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getExecTool()!.handler(ctx as never, { host: 'my-server', command: 'bad-cmd' }, makeMockMeta());

      expect(result).toContain('STDERR:');
      expect(result).toContain('command not found');
      expect(result).toContain('Exit code: 127');
    });

    it('uses custom timeout from input when provided', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      await plugin.register!(ctx as never);

      const host = makeResolvedHost();
      mockResolveHost.mockResolvedValue(host);
      mockPool.getConnection.mockResolvedValue({ exec: vi.fn() });
      mockExecuteCommand.mockResolvedValue({ stdout: 'done', stderr: '', exitCode: 0, timedOut: false });
      (db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await getExecTool()!.handler(ctx as never, { host: 'my-server', command: 'ls', timeout: 60 }, makeMockMeta());

      expect(mockExecuteCommand).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 60_000 }));
    });
  });

  describe('list_hosts tool', () => {
    const getListHostsTool = () => plugin.tools?.find((t) => t.name === 'list_hosts');

    it('returns formatted host list', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      const now = new Date('2026-01-01T12:00:00Z');

      (db.sshHost.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          name: 'web-01',
          hostname: '10.0.0.1',
          port: 22,
          enabled: true,
          lastSeenAt: now,
          tags: [],
        },
      ]);

      const result = await getListHostsTool()!.handler(ctx as never, {}, makeMockMeta());

      expect(result).toContain('web-01');
      expect(result).toContain('10.0.0.1:22');
      expect(result).toContain('2026-01-01T12:00:00.000Z');
    });

    it("returns 'No SSH hosts registered.' when no hosts found", async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await getListHostsTool()!.handler(ctx as never, {}, makeMockMeta());

      expect(result).toBe('No SSH hosts registered.');
    });

    it('returns tag-filtered message when tag filter matches nothing', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          name: 'web-01',
          hostname: '10.0.0.1',
          port: 22,
          enabled: true,
          lastSeenAt: null,
          tags: ['prod'],
        },
      ]);

      const result = await getListHostsTool()!.handler(ctx as never, { tag: 'dev' }, makeMockMeta());

      expect(result).toBe('No SSH hosts found with tag "dev".');
    });

    it('filters hosts by tag', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          name: 'prod-01',
          hostname: '10.0.0.1',
          port: 22,
          enabled: true,
          lastSeenAt: null,
          tags: ['prod'],
        },
        {
          name: 'dev-01',
          hostname: '10.0.0.2',
          port: 22,
          enabled: true,
          lastSeenAt: null,
          tags: ['dev'],
        },
      ]);

      const result = await getListHostsTool()!.handler(ctx as never, { tag: 'prod' }, makeMockMeta());

      expect(result).toContain('prod-01');
      expect(result).not.toContain('dev-01');
    });

    it("shows 'never' for lastSeenAt when null", async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          name: 'new-host',
          hostname: '10.0.0.5',
          port: 22,
          enabled: true,
          lastSeenAt: null,
          tags: [],
        },
      ]);

      const result = await getListHostsTool()!.handler(ctx as never, {}, makeMockMeta());

      expect(result).toContain('last seen: never');
    });

    it('shows tags in output', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          name: 'tagged-host',
          hostname: '10.0.0.7',
          port: 22,
          enabled: true,
          lastSeenAt: null,
          tags: ['prod', 'us-west'],
        },
      ]);

      const result = await getListHostsTool()!.handler(ctx as never, {}, makeMockMeta());

      expect(result).toContain('[prod, us-west]');
    });

    it('returns error string when db throws', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB connection lost'));

      const result = await getListHostsTool()!.handler(ctx as never, {}, makeMockMeta());

      expect(result).toContain('DB connection lost');
    });
  });

  describe('add_host tool', () => {
    const getAddHostTool = () => plugin.tools?.find((t) => t.name === 'add_host');

    it('creates host record and returns confirmation message', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.sshHost.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'new-host-1',
        name: 'my-new-server',
      });

      const result = await getAddHostTool()!.handler(
        ctx as never,
        { name: 'my-new-server', hostname: '192.168.1.50', username: 'ubuntu' },
        makeMockMeta(),
      );

      expect(db.sshHost.create).toHaveBeenCalledWith({
        data: {
          name: 'my-new-server',
          hostname: '192.168.1.50',
          port: 22,
          username: 'ubuntu',
          tags: [],
        },
      });
      expect(result).toContain('my-new-server');
      expect(result).toContain('registered');
    });

    it('defaults port to 22 when not provided', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.sshHost.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await getAddHostTool()!.handler(ctx as never, { name: 'srv', hostname: '10.0.0.1', username: 'user' }, makeMockMeta());

      expect(db.sshHost.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ port: 22 }),
      });
    });

    it('uses provided port when specified', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.sshHost.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await getAddHostTool()!.handler(ctx as never, { name: 'srv', hostname: '10.0.0.1', username: 'user', port: 2222 }, makeMockMeta());

      expect(db.sshHost.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ port: 2222 }),
      });
    });

    it('passes tags when provided', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.sshHost.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await getAddHostTool()!.handler(ctx as never, { name: 'srv', hostname: '10.0.0.1', username: 'user', tags: ['prod', 'web'] }, makeMockMeta());

      expect(db.sshHost.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tags: ['prod', 'web'] }),
      });
    });

    it('returns error string when db.create throws', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      // Mock findUnique to return null (no existing host), so uniqueness check passes
      (db.sshHost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (db.sshHost.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Unique constraint failed'));

      const result = await getAddHostTool()!.handler(ctx as never, { name: 'duplicate', hostname: '10.0.0.1', username: 'user' }, makeMockMeta());

      expect(result).toContain('Unique constraint failed');
    });
  });

  describe('remove_host tool', () => {
    const getRemoveHostTool = () => plugin.tools?.find((t) => t.name === 'remove_host');

    it('deletes host record and returns confirmation', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'host-1', name: 'old-server' });
      (db.sshHost.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await getRemoveHostTool()!.handler(ctx as never, { name: 'old-server' }, makeMockMeta());

      expect(db.sshHost.delete).toHaveBeenCalledWith({ where: { id: 'host-1' } });
      expect(result).toBe('SSH host "old-server" removed.');
    });

    it('returns not-found message when host does not exist', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getRemoveHostTool()!.handler(ctx as never, { name: 'ghost-host' }, makeMockMeta());

      expect(result).toBe('SSH host not found: ghost-host');
      expect(db.sshHost.delete).not.toHaveBeenCalled();
    });

    it('returns error string when db throws', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);

      (db.sshHost.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const result = await getRemoveHostTool()!.handler(ctx as never, { name: 'some-host' }, makeMockMeta());

      expect(result).toContain('DB error');
    });
  });

  describe('test_connection tool', () => {
    const getTestConnectionTool = () => plugin.tools?.find((t) => t.name === 'test_connection');

    it('returns success message when connection succeeds', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      await plugin.register!(ctx as never);

      const host = makeResolvedHost({ fingerprint: 'existing-fingerprint' });
      mockResolveHost.mockResolvedValue(host);
      mockPool.getConnection.mockResolvedValue({ exec: vi.fn() });
      mockExecuteCommand.mockResolvedValue({ stdout: 'ok\n', stderr: '', exitCode: 0, timedOut: false });
      (db.sshHost.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await getTestConnectionTool()!.handler(ctx as never, { host: 'my-server' }, makeMockMeta());

      expect(result).toContain('Connection to "my-server" successful');
      expect(result).toContain('exit code: 0');
    });

    it('updates lastSeenAt after successful connection', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      await plugin.register!(ctx as never);

      const host = makeResolvedHost({ fingerprint: 'fp-abc' });
      mockResolveHost.mockResolvedValue(host);
      mockPool.getConnection.mockResolvedValue({ exec: vi.fn() });
      mockExecuteCommand.mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0, timedOut: false });
      (db.sshHost.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await getTestConnectionTool()!.handler(ctx as never, { host: 'my-server' }, makeMockMeta());

      expect(db.sshHost.update).toHaveBeenCalledWith({
        where: { id: 'host-1' },
        data: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
      });
    });

    it('returns error string when resolveHost throws', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      await plugin.register!(ctx as never);

      mockResolveHost.mockRejectedValue(new Error('SSH host is disabled: locked-server'));

      const result = await getTestConnectionTool()!.handler(ctx as never, { host: 'locked-server' }, makeMockMeta());

      expect(result).toContain('SSH host is disabled: locked-server');
    });

    it('returns error string when getConnection fails', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      await plugin.register!(ctx as never);

      const host = makeResolvedHost();
      mockResolveHost.mockResolvedValue(host);
      mockPool.getConnection.mockRejectedValue(new Error('Connection refused'));

      const result = await getTestConnectionTool()!.handler(ctx as never, { host: 'my-server' }, makeMockMeta());

      expect(result).toContain('Connection refused');
    });

    it('queries the db with echo ok to verify the connection works', async () => {
      const db = makeMockDb();
      const ctx = makeMockCtx(db);
      await plugin.register!(ctx as never);

      const host = makeResolvedHost({ fingerprint: 'fp-xyz' });
      mockResolveHost.mockResolvedValue(host);
      const mockClient = { exec: vi.fn() };
      mockPool.getConnection.mockResolvedValue(mockClient);
      mockExecuteCommand.mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0, timedOut: false });
      (db.sshHost.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await getTestConnectionTool()!.handler(ctx as never, { host: 'my-server' }, makeMockMeta());

      expect(mockExecuteCommand).toHaveBeenCalledWith(expect.objectContaining({ command: 'echo ok' }));
    });
  });
});
