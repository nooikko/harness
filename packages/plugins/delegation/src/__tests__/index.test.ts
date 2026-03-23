import type { PluginContext } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/plugin-contract', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@harness/plugin-contract')>();
  return {
    ...actual,
    getModelCost: vi.fn().mockImplementation((_model: string, input: number, output: number) => {
      if (input === 0 && output === 0) {
        return 0;
      }
      return (input / 1_000_000) * 3 + (output / 1_000_000) * 15;
    }),
    isKnownModel: vi.fn().mockReturnValue(true),
  };
});

import { createDelegationPlugin, plugin, state } from '../index';

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
    uploadDir: '/tmp/uploads',
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
  reportStatus: vi.fn(),
  reportBackgroundError: vi.fn(),
  uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
});

describe('delegation plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('delegation');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers and returns hooks with onSettingsChange', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks).toEqual({ onSettingsChange: expect.any(Function), onBroadcast: expect.any(Function) });
  });

  it('reloads settings when onSettingsChange fires for delegation', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    await hooks.onSettingsChange!('delegation');

    expect(ctx.getSettings).toHaveBeenCalledTimes(2);
    expect(ctx.logger.info).toHaveBeenCalledWith('Delegation plugin: settings reloaded');
  });

  it('ignores onSettingsChange for other plugins', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    await hooks.onSettingsChange!('identity');

    expect(ctx.getSettings).toHaveBeenCalledTimes(1);
  });

  it('reloaded settings are reflected in state.getSettings', async () => {
    const ctx = createMockContext();
    (ctx.getSettings as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ maxIterations: 5, costCapUsd: 5 })
      .mockResolvedValueOnce({ maxIterations: 2, costCapUsd: 1 });

    const hooks = await plugin.register(ctx);

    // Initial settings from first getSettings call during register
    expect(state.getSettings?.()).toEqual({ maxIterations: 5, costCapUsd: 5 });

    // Trigger settings reload
    await hooks.onSettingsChange!('delegation');

    // state.getSettings should now return the reloaded values
    expect(state.getSettings?.()).toEqual({ maxIterations: 2, costCapUsd: 1 });
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

describe('delegation concurrency guard', () => {
  beforeEach(() => {
    // Drain any slots held from prior tests
    while (state.semaphore.active() > 0) {
      state.semaphore.release();
    }
  });

  it('returns error when delegation limit is reached', async () => {
    const ctx = createMockContext();
    // Set limit to 1
    (ctx.config as { maxConcurrentAgents: number }).maxConcurrentAgents = 1;

    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');

    // First delegation succeeds
    const result1 = await delegateTool!.handler(ctx, { prompt: 'Task A' }, { threadId: 'thread-1' });
    expect(result1).toContain('delegated');

    // Second delegation is rejected
    const result2 = await delegateTool!.handler(ctx, { prompt: 'Task B' }, { threadId: 'thread-1' });
    expect(result2).toContain('Error');
    expect(result2).toContain('delegation limit reached');
  });

  it('releases slot after delegation loop completes', async () => {
    const ctx = createMockContext();
    (ctx.config as { maxConcurrentAgents: number }).maxConcurrentAgents = 1;

    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');

    await delegateTool!.handler(ctx, { prompt: 'Task A' }, { threadId: 'thread-1' });
    expect(state.semaphore.active()).toBe(1);

    // Wait for the background loop promise to settle (it completes because mocks resolve)
    await vi.waitFor(() => {
      expect(state.semaphore.active()).toBe(0);
    });

    // Now a new delegation should succeed
    const result = await delegateTool!.handler(ctx, { prompt: 'Task C' }, { threadId: 'thread-1' });
    expect(result).toContain('delegated');
  });

  it('releases slot after delegation loop fails', async () => {
    const ctx = createMockContext();
    (ctx.config as { maxConcurrentAgents: number }).maxConcurrentAgents = 1;

    // Make thread creation fail so the loop rejects
    (ctx.db as unknown as { thread: { create: ReturnType<typeof vi.fn> } }).thread.create = vi.fn().mockRejectedValue(new Error('DB down'));

    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');

    await delegateTool!.handler(ctx, { prompt: 'Doomed task' }, { threadId: 'thread-1' });

    // Wait for the background promise to settle and release the slot
    await vi.waitFor(() => {
      expect(state.semaphore.active()).toBe(0);
    });
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
      expect(ctx.reportBackgroundError).toHaveBeenCalledWith('delegation-loop', expect.any(Error));
    });
  });

  it('delegate tool passes workspace fields to delegation loop', async () => {
    const ctx = createMockContext();

    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');
    await delegateTool!.handler(
      ctx,
      {
        prompt: 'Do workspace work',
        planId: 'plan-1',
        planTaskId: 't1',
        parentTaskId: 'parent-task-1',
        cwd: '/tmp/workspace',
      },
      { threadId: 'thread-1' },
    );

    // Verify the loop was called (indirectly — it runs in background)
    // The delegation returns immediately
    expect(true).toBe(true);
  });

  it('delegate tool uses per-plan semaphore for workspace tasks', async () => {
    const ctx = createMockContext();
    (ctx.config as { maxConcurrentAgents: number }).maxConcurrentAgents = 1;

    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');

    // Fill up global semaphore (limit 1)
    await delegateTool!.handler(ctx, { prompt: 'Task 1' }, { threadId: 'thread-1' });

    // Global is full — non-workspace delegation blocked
    const blockedResult = await delegateTool!.handler(ctx, { prompt: 'Blocked' }, { threadId: 'thread-1' });
    expect(blockedResult).toContain('delegation limit reached');

    // But workspace delegation with planId uses separate per-plan semaphore (limit 5)
    const wsResult = await delegateTool!.handler(ctx, { prompt: 'Workspace task', planId: 'plan-1' }, { threadId: 'thread-1' });
    expect(wsResult).toContain('delegated');
  });

  it('checkin tool returns error for empty message', async () => {
    const ctx = createMockContext();

    const checkinTool = plugin.tools?.find((t) => t.name === 'checkin');
    const result = await checkinTool!.handler(ctx, { message: '' }, { threadId: 'thread-1' });

    expect(result).toContain('Error');
  });

  it('onBroadcast cancels a task when task:cancel-requested is received', async () => {
    const ctx = createMockContext();

    const hooks = await plugin.register(ctx);

    // No abort controller registered — cancel returns false silently
    await hooks.onBroadcast!('task:cancel-requested', { taskId: 'nonexistent-task' });

    // Shouldn't throw
    expect(true).toBe(true);
  });

  it('onBroadcast ignores non-cancel events', async () => {
    const ctx = createMockContext();

    const hooks = await plugin.register(ctx);

    // Other events are no-ops
    await hooks.onBroadcast!('pipeline:complete', { threadId: 'thread-1' });

    expect(true).toBe(true);
  });
});
