import type { InvokeResult, PluginContext } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../_helpers/record-usage-metrics', () => ({
  recordUsageMetrics: vi.fn().mockResolvedValue(undefined),
}));

import { recordUsageMetrics } from '../_helpers/record-usage-metrics';
import { plugin } from '../index';

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
  uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
});

describe('metrics plugin', () => {
  beforeEach(() => {
    mockRecordUsageMetrics.mockClear();
  });

  it('has correct name and version', () => {
    expect(plugin.name).toBe('metrics');
    expect(plugin.version).toBe('1.0.0');
  });

  it('calculates real cost and records metrics for sonnet', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result: InvokeResult = {
      output: 'Hello!',
      durationMs: 1000,
      exitCode: 0,
      model: 'sonnet',
      inputTokens: 1000,
      outputTokens: 500,
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(mockRecordUsageMetrics).toHaveBeenCalledWith(ctx.db, {
      threadId: 'thread-1',
      model: 'sonnet',
      inputTokens: 1000,
      outputTokens: 500,
      costEstimate: expect.closeTo(0.0105),
    });
  });

  it('records metrics for zero-token invocations', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result: InvokeResult = {
      output: '',
      durationMs: 100,
      exitCode: 0,
      model: 'sonnet',
      inputTokens: 0,
      outputTokens: 0,
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(mockRecordUsageMetrics).toHaveBeenCalledWith(ctx.db, {
      threadId: 'thread-1',
      model: 'sonnet',
      inputTokens: 0,
      outputTokens: 0,
      costEstimate: 0,
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

    expect(mockRecordUsageMetrics).not.toHaveBeenCalled();
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('model'));
  });

  it('skips recording when only outputTokens is missing', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result: InvokeResult = {
      output: 'Hello!',
      durationMs: 1000,
      exitCode: 0,
      model: 'sonnet',
      inputTokens: 1000,
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(mockRecordUsageMetrics).not.toHaveBeenCalled();
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('outputTokens'));
  });

  it('skips recording when only inputTokens is missing', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result: InvokeResult = {
      output: 'Hello!',
      durationMs: 1000,
      exitCode: 0,
      model: 'sonnet',
      outputTokens: 500,
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(mockRecordUsageMetrics).not.toHaveBeenCalled();
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('inputTokens'));
  });

  it('logs warning for unknown model but still records metrics', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result: InvokeResult = {
      output: 'Hello!',
      durationMs: 1000,
      exitCode: 0,
      model: 'unknown-future-model',
      inputTokens: 1000,
      outputTokens: 500,
    };

    await hooks.onAfterInvoke?.('thread-1', result);

    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('unknown model "unknown-future-model"'));
    // Still records with fallback Sonnet pricing
    expect(mockRecordUsageMetrics).toHaveBeenCalledWith(
      ctx.db,
      expect.objectContaining({
        model: 'unknown-future-model',
        costEstimate: expect.closeTo(0.0105),
      }),
    );
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
