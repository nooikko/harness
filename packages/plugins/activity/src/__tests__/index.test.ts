// packages/plugins/activity/src/__tests__/index.test.ts
import type { InvokeResult, InvokeStreamEvent, PipelineStep, PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

const makeCtx = (): PluginContext => ({
  db: {
    message: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        message: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    }),
  } as never,
  invoker: {} as never,
  config: {} as never,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  sendToThread: vi.fn(),
  broadcast: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({}),
  notifySettingsChange: vi.fn().mockResolvedValue(undefined),
  reportStatus: vi.fn(),
});

const makeInvokeResult = (overrides: Partial<InvokeResult> = {}): InvokeResult => ({
  output: 'result',
  durationMs: 500,
  exitCode: 0,
  ...overrides,
});

describe('activity plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('activity');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers onPipelineStart and onPipelineComplete hooks', async () => {
    const ctx = makeCtx();
    const hooks = await plugin.register(ctx);
    expect(hooks.onPipelineStart).toBeTypeOf('function');
    expect(hooks.onPipelineComplete).toBeTypeOf('function');
  });

  it('onPipelineStart persists pipeline_start status', async () => {
    const ctx = makeCtx();
    const hooks = await plugin.register(ctx);
    await hooks.onPipelineStart?.('thread-1', { traceId: 'trace-1' });

    expect(ctx.db.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'status',
          metadata: expect.objectContaining({ event: 'pipeline_start', traceId: 'trace-1' }),
        }),
      }),
    );
  });

  it('onPipelineComplete runs all persist calls inside a transaction', async () => {
    const ctx = makeCtx();
    const hooks = await plugin.register(ctx);

    const steps: PipelineStep[] = [{ step: 'onMessage', timestamp: 1000 }];
    const events: InvokeStreamEvent[] = [{ type: 'thinking', content: 'hmm', timestamp: 2000 }];

    await hooks.onPipelineComplete?.('thread-1', {
      invokeResult: makeInvokeResult({ traceId: 'trace-1' }),
      pipelineSteps: steps,
      streamEvents: events,
    });

    // $transaction was called with a callback (interactive transaction)
    expect(ctx.db.$transaction).toHaveBeenCalledTimes(1);
    expect(ctx.db.$transaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it('onPipelineComplete persists steps, stream events, and pipeline_complete inside transaction', async () => {
    const ctx = makeCtx();
    // Track the tx.message.create calls made inside the transaction
    const txCreateCalls: Array<{ data: { kind: string } }> = [];
    (ctx.db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        message: {
          create: vi.fn().mockImplementation((args: { data: { kind: string } }) => {
            txCreateCalls.push(args);
            return Promise.resolve({});
          }),
        },
      };
      return fn(tx);
    });

    const hooks = await plugin.register(ctx);
    const steps: PipelineStep[] = [{ step: 'onMessage', timestamp: 1000 }];
    const events: InvokeStreamEvent[] = [{ type: 'thinking', content: 'hmm', timestamp: 2000 }];

    await hooks.onPipelineComplete?.('thread-1', {
      invokeResult: makeInvokeResult(),
      pipelineSteps: steps,
      streamEvents: events,
    });

    const kinds = txCreateCalls.map((c) => c.data.kind);
    // pipeline_step first, then thinking (stream event), then status (pipeline_complete)
    expect(kinds[0]).toBe('pipeline_step');
    expect(kinds).toContain('thinking');
    expect(kinds[kinds.length - 1]).toBe('status');
  });

  it('onPipelineStart suppresses and logs DB errors', async () => {
    const ctx = makeCtx();
    (ctx.db.message.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB down'));
    const hooks = await plugin.register(ctx);

    await expect(hooks.onPipelineStart?.('thread-1', { traceId: 'trace-1' })).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalled();
    // Only the one failing call — no further writes attempted
    expect(ctx.db.message.create).toHaveBeenCalledTimes(1);
  });

  it('onPipelineComplete suppresses and logs transaction errors', async () => {
    const ctx = makeCtx();
    (ctx.db.$transaction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('transaction failed'));
    const hooks = await plugin.register(ctx);

    const steps: PipelineStep[] = [{ step: 'onMessage', timestamp: 1000 }];
    const events: InvokeStreamEvent[] = [{ type: 'thinking', content: 'hmm', timestamp: 2000 }];

    await expect(
      hooks.onPipelineComplete?.('thread-1', {
        invokeResult: makeInvokeResult(),
        pipelineSteps: steps,
        streamEvents: events,
      }),
    ).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalled();
  });

  it('onPipelineStart logs non-Error thrown values as string', async () => {
    const ctx = makeCtx();
    (ctx.db.message.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce('string error');
    const hooks = await plugin.register(ctx);

    await expect(hooks.onPipelineStart?.('thread-1', { traceId: 'trace-1' })).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });

  it('onPipelineComplete logs non-Error thrown values as string', async () => {
    const ctx = makeCtx();
    (ctx.db.$transaction as ReturnType<typeof vi.fn>).mockRejectedValueOnce('string error');
    const hooks = await plugin.register(ctx);

    await expect(
      hooks.onPipelineComplete?.('thread-1', {
        invokeResult: makeInvokeResult(),
        pipelineSteps: [],
        streamEvents: [],
      }),
    ).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });

  it('onPipelineComplete rolls back all writes if any helper throws inside transaction', async () => {
    const ctx = makeCtx();
    const txCreateCalls: unknown[] = [];
    (ctx.db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        message: {
          create: vi.fn().mockImplementation((args: unknown) => {
            txCreateCalls.push(args);
            // Fail on the second create (stream events)
            if (txCreateCalls.length === 2) {
              return Promise.reject(new Error('write failed'));
            }
            return Promise.resolve({});
          }),
        },
      };
      return fn(tx);
    });

    const hooks = await plugin.register(ctx);
    const steps: PipelineStep[] = [{ step: 'onMessage', timestamp: 1000 }];
    const events: InvokeStreamEvent[] = [{ type: 'thinking', content: 'hmm', timestamp: 2000 }];

    await expect(
      hooks.onPipelineComplete?.('thread-1', {
        invokeResult: makeInvokeResult(),
        pipelineSteps: steps,
        streamEvents: events,
      }),
    ).resolves.toBeUndefined();

    // Error was caught and logged
    expect(ctx.logger.error).toHaveBeenCalled();
    // The transaction was attempted
    expect(ctx.db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('onPipelineComplete passes traceId from invokeResult to helpers', async () => {
    const ctx = makeCtx();
    const txCreateCalls: Array<{ data: { metadata?: Record<string, unknown> } }> = [];
    (ctx.db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        message: {
          create: vi.fn().mockImplementation((args: { data: { metadata?: Record<string, unknown> } }) => {
            txCreateCalls.push(args);
            return Promise.resolve({});
          }),
        },
      };
      return fn(tx);
    });

    const hooks = await plugin.register(ctx);
    const steps: PipelineStep[] = [{ step: 'onMessage', timestamp: 1000 }];

    await hooks.onPipelineComplete?.('thread-1', {
      invokeResult: makeInvokeResult({ traceId: 'trace-abc' }),
      pipelineSteps: steps,
      streamEvents: [],
    });

    // pipeline_step should include traceId
    const stepCall = txCreateCalls.find((c) => c.data.metadata && 'step' in c.data.metadata);
    expect(stepCall?.data.metadata).toHaveProperty('traceId', 'trace-abc');
    // pipeline_complete should include traceId
    const completeCall = txCreateCalls.find((c) => c.data.metadata && 'event' in c.data.metadata);
    expect(completeCall?.data.metadata).toHaveProperty('traceId', 'trace-abc');
  });
});
