import type { InvokeResult, PluginContext } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../_helpers/calculate-cost', () => ({
  calculateCost: vi.fn().mockReturnValue({
    inputCost: 0.003,
    outputCost: 0.0075,
    totalCost: 0.0105,
  }),
}));

vi.mock('../_helpers/record-usage-metrics', () => ({
  recordUsageMetrics: vi.fn().mockResolvedValue(undefined),
}));

import { calculateCost } from '../_helpers/calculate-cost';
import { recordUsageMetrics } from '../_helpers/record-usage-metrics';
import { plugin } from '../index';

const mockCalculateCost = vi.mocked(calculateCost);
const mockRecordUsageMetrics = vi.mocked(recordUsageMetrics);

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () => ({
  db: {} as never,
  invoker: { invoke: vi.fn() },
  config: {
    claudeModel: 'sonnet',
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
});

describe('metrics plugin', () => {
  beforeEach(() => {
    mockCalculateCost.mockClear();
    mockRecordUsageMetrics.mockClear();
  });

  it('has correct name and version', () => {
    expect(plugin.name).toBe('metrics');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers and returns onAfterInvoke hook', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks.onAfterInvoke).toBeDefined();
    expect(typeof hooks.onAfterInvoke).toBe('function');
  });

  it('calculates cost and records metrics on invoke', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result: InvokeResult = {
      output: 'Hello!',
      durationMs: 1000,
      exitCode: 0,
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(mockCalculateCost).toHaveBeenCalledWith('claude-sonnet-4-20250514', 1000, 500);
    expect(mockRecordUsageMetrics).toHaveBeenCalledWith(ctx.db, {
      threadId: 'thread-1',
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
      costEstimate: 0.0105,
    });
  });

  it('skips recording when model is missing from result', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result: InvokeResult = {
      output: 'Hello!',
      durationMs: 1000,
      exitCode: 0,
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(mockCalculateCost).not.toHaveBeenCalled();
    expect(mockRecordUsageMetrics).not.toHaveBeenCalled();
  });

  it('skips recording when token counts are missing', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result: InvokeResult = {
      output: 'Hello!',
      durationMs: 1000,
      exitCode: 0,
      model: 'sonnet',
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(mockRecordUsageMetrics).not.toHaveBeenCalled();
  });

  it('logs error and continues when recording fails', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    mockRecordUsageMetrics.mockRejectedValueOnce(new Error('DB down'));

    const result: InvokeResult = {
      output: 'Hello!',
      durationMs: 1000,
      exitCode: 0,
      model: 'sonnet',
      inputTokens: 100,
      outputTokens: 50,
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('DB down'));
  });
});
