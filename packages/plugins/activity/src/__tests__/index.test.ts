// packages/plugins/activity/src/__tests__/index.test.ts
import type { InvokeResult, InvokeStreamEvent, PipelineStep, PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

const makeCtx = (): PluginContext => ({
  db: { message: { create: vi.fn().mockResolvedValue({}) } } as never,
  invoker: {} as never,
  config: {} as never,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  sendToThread: vi.fn(),
  broadcast: vi.fn(),
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
    await hooks.onPipelineStart?.('thread-1');

    expect(ctx.db.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'status',
          metadata: expect.objectContaining({ event: 'pipeline_start' }),
        }),
      }),
    );
  });

  it('onPipelineComplete persists steps, stream events, and pipeline_complete', async () => {
    const ctx = makeCtx();
    const hooks = await plugin.register(ctx);

    const steps: PipelineStep[] = [{ step: 'onMessage', timestamp: 1000 }];
    const events: InvokeStreamEvent[] = [{ type: 'thinking', content: 'hmm', timestamp: 2000 }];

    await hooks.onPipelineComplete?.('thread-1', {
      invokeResult: makeInvokeResult(),
      pipelineSteps: steps,
      streamEvents: events,
      commandsHandled: [],
    });

    const createCalls = (ctx.db.message.create as ReturnType<typeof vi.fn>).mock.calls as Array<[{ data: { kind: string } }]>;
    const kinds = createCalls.map((c) => c[0]?.data.kind);
    expect(kinds).toContain('pipeline_step');
    expect(kinds).toContain('thinking');
    expect(kinds).toContain('status'); // pipeline_complete
  });

  it('onPipelineStart suppresses and logs DB errors', async () => {
    const ctx = makeCtx();
    (ctx.db.message.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB down'));
    const hooks = await plugin.register(ctx);

    await expect(hooks.onPipelineStart?.('thread-1')).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalled();
  });

  it('onPipelineComplete suppresses and logs DB errors', async () => {
    const ctx = makeCtx();
    (ctx.db.message.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB down'));
    const hooks = await plugin.register(ctx);

    await expect(
      hooks.onPipelineComplete?.('thread-1', {
        invokeResult: makeInvokeResult(),
        pipelineSteps: [],
        streamEvents: [],
        commandsHandled: [],
      }),
    ).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalled();
  });

  it('onPipelineStart logs non-Error thrown values as string', async () => {
    const ctx = makeCtx();
    (ctx.db.message.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce('string error');
    const hooks = await plugin.register(ctx);

    await expect(hooks.onPipelineStart?.('thread-1')).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });

  it('onPipelineComplete logs non-Error thrown values as string', async () => {
    const ctx = makeCtx();
    (ctx.db.message.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce('string error');
    const hooks = await plugin.register(ctx);

    await expect(
      hooks.onPipelineComplete?.('thread-1', {
        invokeResult: makeInvokeResult(),
        pipelineSteps: [],
        streamEvents: [],
        commandsHandled: [],
      }),
    ).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });
});
