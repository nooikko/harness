import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { createDelegationPlugin, plugin } from '../index';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () => ({
  db: (() => {
    const db: Record<string, unknown> = {
      thread: {
        create: vi.fn().mockResolvedValue({ id: 'thread-task-1' }),
        update: vi.fn().mockResolvedValue({}),
      },
      orchestratorTask: {
        create: vi.fn().mockResolvedValue({ id: 'task-1' }),
        update: vi.fn().mockResolvedValue({}),
      },
      message: {
        create: vi.fn().mockResolvedValue({}),
      },
      agentRun: {
        create: vi.fn().mockResolvedValue({ id: 'run-123' }),
      },
      metric: {
        createMany: vi.fn().mockResolvedValue({ count: 4 }),
      },
    };
    db.$transaction = vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(db));
    return db;
  })() as never,
  invoker: {
    invoke: vi.fn().mockResolvedValue({
      output: 'Done',
      durationMs: 500,
      exitCode: 0,
    }),
  },
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
  } as never,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  sendToThread: vi.fn(),
  broadcast: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({}),
  notifySettingsChange: vi.fn().mockResolvedValue(undefined),
});

describe('delegation plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('delegation');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers and returns empty hooks (no text command routing needed — tools handle delegation)', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks).toEqual({});
  });

  it('logs registration message', async () => {
    const ctx = createMockContext();
    await plugin.register(ctx);

    expect(ctx.logger.info).toHaveBeenCalledWith('Delegation plugin registered');
  });

  it('creates delegation plugin via factory function', () => {
    const created = createDelegationPlugin();

    expect(created.name).toBe('delegation');
    expect(created.version).toBe('1.0.0');
    expect(typeof created.register).toBe('function');
  });
});

describe('plugin tools', () => {
  it('defines delegate and checkin tools', () => {
    expect(plugin.tools).toBeDefined();
    expect(plugin.tools).toHaveLength(2);
  });

  it('delegate tool has correct name and schema', () => {
    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');
    expect(delegateTool).toBeDefined();
    expect(delegateTool!.description).toContain('sub-agent');
    expect(delegateTool!.schema).toEqual(
      expect.objectContaining({
        type: 'object',
        required: ['prompt'],
      }),
    );
    expect(typeof delegateTool!.handler).toBe('function');
  });

  it('checkin tool has correct name and schema', () => {
    const checkinTool = plugin.tools?.find((t) => t.name === 'checkin');
    expect(checkinTool).toBeDefined();
    expect(checkinTool!.description).toContain('progress');
    expect(checkinTool!.schema).toEqual(
      expect.objectContaining({
        type: 'object',
        required: ['message'],
      }),
    );
    expect(typeof checkinTool!.handler).toBe('function');
  });

  it('delegate tool handler calls runDelegationLoop', async () => {
    const ctx = createMockContext();
    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');
    const result = await delegateTool!.handler(ctx, { prompt: 'Research X' }, { threadId: 'thread-1' });
    expect(typeof result).toBe('string');
    expect(result).toContain('delegated');
  });

  it('checkin tool handler calls handleCheckin', async () => {
    const ctx = createMockContext();

    // Add thread.findUnique for checkin handler
    (ctx.db as unknown as { thread: { findUnique: ReturnType<typeof vi.fn> } }).thread.findUnique = vi
      .fn()
      .mockResolvedValue({ parentThreadId: 'parent-thread-1' });

    const checkinTool = plugin.tools?.find((t) => t.name === 'checkin');
    const result = await checkinTool!.handler(ctx, { message: 'Making progress' }, { threadId: 'thread-1' });
    expect(result).toContain('Check-in sent');
  });

  it('checkin tool handler returns error when handleCheckin fails', async () => {
    const ctx = createMockContext();

    // No thread.findUnique mock — handleCheckin will fail to find thread
    (ctx.db as unknown as { thread: { findUnique: ReturnType<typeof vi.fn> } }).thread.findUnique = vi.fn().mockResolvedValue(null);

    const checkinTool = plugin.tools?.find((t) => t.name === 'checkin');
    const result = await checkinTool!.handler(ctx, { message: 'Progress' }, { threadId: 'thread-orphan' });
    expect(result).toContain('Error');
    expect(result).toContain('failed');
  });

  it('delegate tool handler returns error for empty prompt', async () => {
    const ctx = createMockContext();
    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');
    const result = await delegateTool!.handler(ctx, { prompt: '   ' }, { threadId: 'thread-1' });
    expect(result).toContain('Error');
    expect(result).toContain('prompt is required');
  });

  it('delegate tool handler logs error when delegation loop fails', async () => {
    const ctx = createMockContext();

    // Make the thread creation fail to trigger the catch branch
    (ctx.db as unknown as { thread: { create: ReturnType<typeof vi.fn> } }).thread.create = vi.fn().mockRejectedValue(new Error('DB failure'));

    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');
    const result = await delegateTool!.handler(ctx, { prompt: 'Do work' }, { threadId: 'thread-1' });

    expect(result).toContain('delegated');

    // Wait for the background promise to settle and log the error
    await vi.waitFor(() => {
      expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('Delegation tool failed'));
    });
  });
});
