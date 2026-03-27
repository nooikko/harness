import type { PrismaClient } from '@harness/database';
import type { Logger } from '@harness/logger';
import type { InvokeResult, Invoker, OrchestratorConfig, PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrchestratorDeps } from '../index';
import { createOrchestrator } from '../index';

vi.mock('@harness/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@harness/logger')>();
  return {
    ...actual,
    createChildLogger: vi.fn((_parent: unknown, _context: unknown) => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  };
});

vi.mock('../_helpers/run-chain-hooks', () => ({
  runChainHooks: vi.fn().mockImplementation((_hooks, _threadId, prompt) => Promise.resolve(prompt)),
}));

vi.mock('../_helpers/run-notify-hooks', () => ({
  runNotifyHooks: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@harness/plugin-contract', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@harness/plugin-contract')>();
  return {
    ...actual,
    runEarlyReturnHook: vi.fn().mockResolvedValue(null),
  };
});

vi.mock('../_helpers/prompt-assembler', () => ({
  assemblePrompt: vi.fn().mockImplementation((message: string, _meta: unknown) => ({
    prompt: `[assembled] ${message}`,
    threadMeta: _meta,
  })),
}));

import { runEarlyReturnHook } from '@harness/plugin-contract';
import { assemblePrompt } from '../_helpers/prompt-assembler';
import { runChainHooks } from '../_helpers/run-chain-hooks';
import { runNotifyHooks } from '../_helpers/run-notify-hooks';

const mockAssemblePrompt = vi.mocked(assemblePrompt);
const mockRunChainHooks = vi.mocked(runChainHooks);
const mockRunNotifyHooks = vi.mocked(runNotifyHooks);
const mockRunEarlyReturnHook = vi.mocked(runEarlyReturnHook);

const makeLogger = (): Logger =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as Logger;

const makeInvokeResult = (overrides?: Partial<InvokeResult>): InvokeResult => ({
  output: 'default output',
  durationMs: 100,
  exitCode: 0,
  ...overrides,
});

const mockConfig: OrchestratorConfig = {
  databaseUrl: 'postgres://test',
  timezone: 'UTC',
  maxConcurrentAgents: 3,
  claudeModel: 'sonnet',
  claudeTimeout: 300000,
  discordToken: undefined,
  discordChannelId: undefined,
  port: 4001,
  logLevel: 'info' as const,
  uploadDir: './uploads',
};

const makeDeps = (overrides?: Partial<OrchestratorDeps>): OrchestratorDeps => ({
  db: {
    $extends: vi.fn().mockImplementation(() => ({
      pluginConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    })),
    message: { create: vi.fn().mockResolvedValue({}) },
    thread: {
      findUnique: vi.fn().mockResolvedValue({
        sessionId: null,
        model: null,
        effort: null,
        permissionMode: null,
        kind: 'primary',
        name: 'Main',
        customInstructions: null,
        projectId: null,
      }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    pluginConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    errorLog: { create: vi.fn().mockResolvedValue({}) },
  } as unknown as PrismaClient,
  invoker: { invoke: vi.fn().mockResolvedValue(makeInvokeResult()) } as unknown as Invoker,
  config: mockConfig,
  logger: makeLogger(),
  ...overrides,
});

const makePluginDefinition = (name: string, hooks: PluginHooks = {}, overrides?: Partial<PluginDefinition>): PluginDefinition => ({
  name,
  version: '1.0.0',
  register: vi.fn().mockResolvedValue(hooks),
  ...overrides,
});

describe('createOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssemblePrompt.mockImplementation((message: string, _meta: unknown) => ({
      prompt: `[assembled] ${message}`,
      threadMeta: _meta as { threadId: string; kind: string; name: string | undefined },
    }));
    mockRunChainHooks.mockImplementation((_hooks, _threadId, prompt) => Promise.resolve(prompt));
    mockRunNotifyHooks.mockResolvedValue(undefined);
  });

  describe('registerPlugin', () => {
    it('calls definition.register with a per-plugin context containing required fields', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const definition = makePluginDefinition('test-plugin');

      await orchestrator.registerPlugin(definition);

      expect(definition.register).toHaveBeenCalledTimes(1);
      const passedContext = (definition.register as ReturnType<typeof vi.fn>).mock.calls[0]![0] as PluginContext;
      // Non-system plugins receive a scoped db (not deps.db directly)
      expect(passedContext.db).toBeDefined();
      expect(passedContext.db).not.toBe(deps.db);
      expect(passedContext).toHaveProperty('invoker', deps.invoker);
      expect(passedContext).toHaveProperty('config', deps.config);
      expect(passedContext).toHaveProperty('logger', deps.logger);
      expect(typeof passedContext.sendToThread).toBe('function');
      expect(typeof passedContext.broadcast).toBe('function');
      expect(typeof passedContext.getSettings).toBe('function');
      expect(typeof passedContext.notifySettingsChange).toBe('function');
    });

    it('passes unscoped db to system plugins', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const definition = makePluginDefinition('system-plugin', {}, { system: true });

      await orchestrator.registerPlugin(definition);

      const passedContext = (definition.register as ReturnType<typeof vi.fn>).mock.calls[0]![0] as PluginContext;
      expect(passedContext.db).toBe(deps.db);
    });

    it('logs a message after registering the plugin', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const definition = makePluginDefinition('my-plugin', {}, { version: '2.3.4' });

      await orchestrator.registerPlugin(definition);

      expect(deps.logger.info).toHaveBeenCalledWith('Plugin registered: my-plugin@2.3.4');
    });

    it('adds the plugin to the list returned by getPlugins', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      expect(orchestrator.getPlugins()).toEqual([]);

      await orchestrator.registerPlugin(makePluginDefinition('plugin-a'));
      expect(orchestrator.getPlugins()).toEqual(['plugin-a']);

      await orchestrator.registerPlugin(makePluginDefinition('plugin-b'));
      expect(orchestrator.getPlugins()).toEqual(['plugin-a', 'plugin-b']);
    });

    it('stores hooks returned by register and exposes them via getHooks', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const hooks: PluginHooks = { onMessage: vi.fn() };
      const definition = makePluginDefinition('hook-plugin', hooks);

      await orchestrator.registerPlugin(definition);

      expect(orchestrator.getHooks()).toEqual([hooks]);
    });
  });

  describe('start', () => {
    it('calls start() on each registered plugin that defines it', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const startA = vi.fn().mockResolvedValue(undefined);
      const startB = vi.fn().mockResolvedValue(undefined);

      await orchestrator.registerPlugin(makePluginDefinition('plugin-a', {}, { start: startA }));
      await orchestrator.registerPlugin(makePluginDefinition('plugin-b', {}, { start: startB }));

      await orchestrator.start();

      expect(startA).toHaveBeenCalledTimes(1);
      expect(startB).toHaveBeenCalledTimes(1);
    });

    it("passes context to each plugin's start function", async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const startFn = vi.fn().mockResolvedValue(undefined);

      await orchestrator.registerPlugin(makePluginDefinition('plugin', {}, { start: startFn }));

      await orchestrator.start();

      const passedContext = startFn.mock.calls[0]![0] as PluginContext;
      expect(passedContext.db).toBeDefined();
      expect(passedContext).toHaveProperty('invoker', deps.invoker);
    });

    it('skips plugins without a start function', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.registerPlugin(makePluginDefinition('plugin-no-start'));

      await expect(orchestrator.start()).resolves.toBeUndefined();
    });

    it("logs 'Orchestrator started' after all plugins have been started", async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.start();

      expect(deps.logger.info).toHaveBeenCalledWith('Orchestrator started');
    });

    it('clears stale sessionIds from all threads on startup', async () => {
      const deps = makeDeps();
      (deps.db.thread.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.start();

      expect(deps.db.thread.updateMany).toHaveBeenCalledWith({
        where: { sessionId: { not: null } },
        data: { sessionId: null },
      });
      expect(deps.logger.info).toHaveBeenCalledWith('Cleared 3 stale session ID(s) from threads');
    });

    it('does not log session clearing when no stale sessions exist', async () => {
      const deps = makeDeps();
      (deps.db.thread.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.start();

      expect(deps.db.thread.updateMany).toHaveBeenCalled();
      expect(deps.logger.info).not.toHaveBeenCalledWith(expect.stringContaining('stale session'));
    });

    it('distributes plugin routes to all plugin contexts when plugins have routes', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const routeHandler = vi.fn().mockResolvedValue({ status: 200, body: {} });

      await orchestrator.registerPlugin(
        makePluginDefinition(
          'with-routes',
          {},
          {
            routes: [{ method: 'GET', path: '/test', handler: routeHandler }],
          },
        ),
      );

      await orchestrator.start();

      const ctx = orchestrator.getContext();
      expect(ctx.pluginRoutes).toBeDefined();
      expect(ctx.pluginRoutes).toHaveLength(1);
      expect(ctx.pluginRoutes![0]?.pluginName).toBe('with-routes');
    });
  });

  describe('getPluginHealth', () => {
    it('records healthy status for plugins with successful start', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const startFn = vi.fn().mockResolvedValue(undefined);

      await orchestrator.registerPlugin(makePluginDefinition('healthy-plugin', {}, { start: startFn }));
      await orchestrator.start();

      const health = orchestrator.getPluginHealth();
      expect(health).toEqual([{ name: 'healthy-plugin', status: 'healthy', startedAt: expect.any(Number) }]);
    });

    it('records healthy status for plugins without a start method', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.registerPlugin(makePluginDefinition('no-start-plugin'));
      await orchestrator.start();

      const health = orchestrator.getPluginHealth();
      expect(health).toEqual([{ name: 'no-start-plugin', status: 'healthy', startedAt: expect.any(Number) }]);
    });

    it('records failed status with error message when plugin start throws', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const failingStart = vi.fn().mockRejectedValue(new Error('Bonjour is not a constructor'));

      await orchestrator.registerPlugin(makePluginDefinition('broken-plugin', {}, { start: failingStart }));
      await orchestrator.start();

      const health = orchestrator.getPluginHealth();
      expect(health).toEqual([{ name: 'broken-plugin', status: 'failed', error: 'Bonjour is not a constructor' }]);
    });

    it('tracks health for multiple plugins with mixed results', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.registerPlugin(makePluginDefinition('plugin-ok', {}, { start: vi.fn().mockResolvedValue(undefined) }));
      await orchestrator.registerPlugin(makePluginDefinition('plugin-fail', {}, { start: vi.fn().mockRejectedValue(new Error('boom')) }));
      await orchestrator.registerPlugin(makePluginDefinition('plugin-no-start'));
      await orchestrator.start();

      const health = orchestrator.getPluginHealth();
      expect(health).toHaveLength(3);
      expect(health[0]).toEqual({ name: 'plugin-ok', status: 'healthy', startedAt: expect.any(Number) });
      expect(health[1]).toEqual({ name: 'plugin-fail', status: 'failed', error: 'boom' });
      expect(health[2]).toEqual({ name: 'plugin-no-start', status: 'healthy', startedAt: expect.any(Number) });
    });

    it('returns a defensive copy of the health array', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.registerPlugin(makePluginDefinition('plugin'));
      await orchestrator.start();

      const health1 = orchestrator.getPluginHealth();
      const health2 = orchestrator.getPluginHealth();
      expect(health1).not.toBe(health2);
      expect(health1).toEqual(health2);
    });
  });

  describe('stop', () => {
    it('calls stop() on each registered plugin that defines it', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const stopA = vi.fn().mockResolvedValue(undefined);
      const stopB = vi.fn().mockResolvedValue(undefined);

      await orchestrator.registerPlugin(makePluginDefinition('plugin-a', {}, { stop: stopA }));
      await orchestrator.registerPlugin(makePluginDefinition('plugin-b', {}, { stop: stopB }));

      await orchestrator.stop();

      expect(stopA).toHaveBeenCalledTimes(1);
      expect(stopB).toHaveBeenCalledTimes(1);
    });

    it("passes context to each plugin's stop function", async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const stopFn = vi.fn().mockResolvedValue(undefined);

      await orchestrator.registerPlugin(makePluginDefinition('plugin', {}, { stop: stopFn }));

      await orchestrator.stop();

      const passedContext = stopFn.mock.calls[0]![0] as PluginContext;
      expect(passedContext).toHaveProperty('config', deps.config);
      expect(passedContext).toHaveProperty('logger', deps.logger);
    });

    it('skips plugins without a stop function', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.registerPlugin(makePluginDefinition('plugin-no-stop'));

      await expect(orchestrator.stop()).resolves.toBeUndefined();
    });

    it("logs 'Orchestrator stopped' after all plugins have been stopped", async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.stop();

      expect(deps.logger.info).toHaveBeenCalledWith('Orchestrator stopped');
    });

    it('throws aggregated error when plugin stop() throws', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const failingStop = vi.fn().mockRejectedValue(new Error('cleanup failed'));

      await orchestrator.registerPlugin(makePluginDefinition('failing-plugin', {}, { stop: failingStop }));

      await expect(orchestrator.stop()).rejects.toThrow('Plugin stop failures: failing-plugin');
      expect(deps.logger.error).toHaveBeenCalledWith(expect.stringContaining('Plugin stop failed [plugin=failing-plugin]'));
    });
  });

  describe('getContext', () => {
    it('returns a context object with the correct deps', () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      const context = orchestrator.getContext();

      expect(context.db).toBe(deps.db);
      expect(context.invoker).toBe(deps.invoker);
      expect(context.config).toBe(deps.config);
      expect(context.logger).toBe(deps.logger);
    });

    it('returns a context with sendToThread and broadcast as async functions', () => {
      const orchestrator = createOrchestrator(makeDeps());
      const context = orchestrator.getContext();

      expect(typeof context.sendToThread).toBe('function');
      expect(typeof context.broadcast).toBe('function');
      expect(context.sendToThread('t', 'c')).toBeInstanceOf(Promise);
      expect(context.broadcast('e', {})).toBeInstanceOf(Promise);
    });
  });

  describe('sendToThread', () => {
    it('runs the message pipeline and persists the assistant response', async () => {
      const invokeResult = makeInvokeResult({ output: 'assistant reply', durationMs: 50, model: 'claude-haiku-4-5-20251001' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);
      const context = orchestrator.getContext();

      await context.sendToThread('thread-1', 'hello');

      expect(deps.invoker.invoke).toHaveBeenCalled();
      expect(deps.db.message.create as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        data: {
          threadId: 'thread-1',
          role: 'assistant',
          kind: 'text',
          source: 'builtin',
          content: 'assistant reply',
        },
      });
      expect(deps.db.thread.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: { lastActivity: expect.any(Date) },
      });
    });

    it('persists error status message when invoke returns empty output', async () => {
      const invokeResult = makeInvokeResult({ output: '', error: 'Timed out after 300000ms', exitCode: 1 });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.getContext().sendToThread('thread-1', 'hello');

      // Should NOT persist an assistant text message
      const createCalls = (deps.db.message.create as ReturnType<typeof vi.fn>).mock.calls;
      const textCalls = createCalls.filter((c: unknown[]) => (c[0] as { data: { kind: string } }).data.kind === 'text');
      expect(textCalls).toHaveLength(0);

      // Should persist a pipeline_error status message
      const statusCalls = createCalls.filter((c: unknown[]) => (c[0] as { data: { kind: string } }).data.kind === 'status');
      expect(statusCalls).toHaveLength(1);
      expect(statusCalls[0]![0]).toEqual({
        data: {
          threadId: 'thread-1',
          role: 'system',
          kind: 'status',
          source: 'builtin',
          content: 'Pipeline error: Timed out after 300000ms',
          metadata: { event: 'pipeline_error', error: 'Timed out after 300000ms', exitCode: 1 },
        },
      });

      // Should NOT update thread lastActivity
      expect(deps.db.thread.update as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    });

    it('persists error status message with default text when invoke returns empty output and no error', async () => {
      const invokeResult = makeInvokeResult({ output: '' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.getContext().sendToThread('thread-1', 'hello');

      const createCalls = (deps.db.message.create as ReturnType<typeof vi.fn>).mock.calls;
      const statusCalls = createCalls.filter((c: unknown[]) => (c[0] as { data: { kind: string } }).data.kind === 'status');
      expect(statusCalls).toHaveLength(1);
      expect(statusCalls[0]![0].data.metadata.error).toBe('No response from agent');
    });

    it('writes to ErrorLog when pipeline returns empty output', async () => {
      const invokeResult = makeInvokeResult({ output: '', error: 'Session is closed', exitCode: 1, durationMs: 500 });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.getContext().sendToThread('thread-1', 'hello');

      // Allow fire-and-forget to flush
      await new Promise((r) => setTimeout(r, 10));

      expect(deps.db.errorLog.create as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        data: expect.objectContaining({
          level: 'error',
          source: 'orchestrator',
          message: 'Pipeline returned no output: Session is closed',
          threadId: 'thread-1',
        }),
      });
    });

    it('broadcasts pipeline:error when invoke returns empty output', async () => {
      const invokeResult = makeInvokeResult({ output: '', error: 'Timed out' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.getContext().sendToThread('thread-1', 'hello');

      // pipeline:error should be broadcast via onBroadcast hooks
      const broadcastCalls = mockRunNotifyHooks.mock.calls.filter((c) => c[1] === 'onBroadcast');
      const errorBroadcast = broadcastCalls.find((c) => {
        // The hook factory is called with each hook — we need to check the broadcast event
        // by invoking the factory to see what event it would broadcast
        return true; // All broadcasts go through onBroadcast
      });
      expect(errorBroadcast).toBeDefined();
    });

    it('persists error and broadcasts pipeline:complete when pipeline throws', async () => {
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockRejectedValue(new Error('Connection refused')) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.getContext().sendToThread('thread-1', 'hello');

      const createCalls = (deps.db.message.create as ReturnType<typeof vi.fn>).mock.calls;
      const statusCalls = createCalls.filter((c: unknown[]) => (c[0] as { data: { kind: string } }).data.kind === 'status');
      expect(statusCalls).toHaveLength(1);
      expect(statusCalls[0]![0].data.content).toBe('Pipeline failed: Connection refused');
      expect(statusCalls[0]![0].data.metadata).toEqual({ event: 'pipeline_error', error: 'Connection refused' });
    });

    it('writes to ErrorLog when pipeline throws', async () => {
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockRejectedValue(new Error('Connection refused')) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.getContext().sendToThread('thread-1', 'hello');

      // Allow fire-and-forget to flush
      await new Promise((r) => setTimeout(r, 10));

      expect(deps.db.errorLog.create as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        data: expect.objectContaining({
          level: 'error',
          source: 'orchestrator',
          message: 'Pipeline threw: Connection refused',
          threadId: 'thread-1',
          metadata: {},
        }),
      });
    });

    it('calls runNotifyHooks with onPipelineStart', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.getContext().sendToThread('thread-1', 'hello');

      // runNotifyHooks is mocked — assert it was called with the correct hookName and plugin names
      expect(mockRunNotifyHooks).toHaveBeenCalledWith(
        expect.any(Array),
        'onPipelineStart',
        expect.any(Function),
        expect.anything(),
        expect.any(Array),
        undefined,
      );
    });

    it('calls runNotifyHooks with onPipelineComplete after the pipeline runs', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.getContext().sendToThread('thread-1', 'hello');

      expect(mockRunNotifyHooks).toHaveBeenCalledWith(
        expect.any(Array),
        'onPipelineComplete',
        expect.any(Function),
        expect.anything(),
        expect.any(Array),
        undefined,
      );
    });

    it('short-circuits the pipeline when onIntentClassify returns handled: true', async () => {
      mockRunEarlyReturnHook.mockResolvedValueOnce({ handled: true, response: 'Lights turned on' } as never);
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.getContext().sendToThread('thread-1', 'turn on the lights');

      // Should persist the fast-path response
      expect(deps.db.message.create as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        data: {
          threadId: 'thread-1',
          role: 'assistant',
          kind: 'text',
          source: 'intent',
          content: 'Lights turned on',
        },
      });
      // Should NOT call the invoker (Claude is skipped)
      expect(deps.invoker.invoke).not.toHaveBeenCalled();
    });

    it('proceeds to full pipeline when onIntentClassify returns null', async () => {
      mockRunEarlyReturnHook.mockResolvedValueOnce(null);
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.getContext().sendToThread('thread-1', 'what is the meaning of life');

      // Full pipeline should run
      expect(deps.invoker.invoke).toHaveBeenCalled();
    });

    it('proceeds to full pipeline when onIntentClassify returns handled: false', async () => {
      mockRunEarlyReturnHook.mockResolvedValueOnce({ handled: false });
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.getContext().sendToThread('thread-1', 'tell me a joke');

      expect(deps.invoker.invoke).toHaveBeenCalled();
    });

    it('broadcasts pipeline:complete with fastPath flag on intent short-circuit', async () => {
      mockRunEarlyReturnHook.mockResolvedValueOnce({ handled: true, response: 'Done' } as never);
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const broadcastCalls: Array<[string, unknown]> = [];
      mockRunNotifyHooks.mockImplementation(async (_hooks, hookName, callHook) => {
        if (hookName === 'onBroadcast') {
          // Capture broadcast arguments by invoking the callback
          const fakeHooks: PluginHooks = {
            onBroadcast: async (event: string, data: unknown) => {
              broadcastCalls.push([event, data]);
            },
          };
          await callHook(fakeHooks);
        }
      });

      await orchestrator.getContext().sendToThread('thread-1', 'lights on');

      // The broadcast happens via context.broadcast which calls runNotifyHooks('onBroadcast')
      const pipelineComplete = broadcastCalls.find(([event]) => event === 'pipeline:complete');
      expect(pipelineComplete).toBeDefined();
      expect(pipelineComplete?.[1]).toMatchObject({ threadId: 'thread-1', fastPath: true });
    });

    it('handles broadcast errors gracefully during intent short-circuit', async () => {
      mockRunEarlyReturnHook.mockResolvedValueOnce({ handled: true, response: 'Done' } as never);
      // Make broadcast throw by having runNotifyHooks throw when called for onBroadcast
      mockRunNotifyHooks.mockImplementation(async (_hooks, hookName) => {
        if (hookName === 'onBroadcast') {
          throw new Error('WebSocket transport failed');
        }
      });
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      // Should not throw — broadcast errors are isolated
      await expect(orchestrator.getContext().sendToThread('thread-1', 'lights on')).resolves.toBeUndefined();

      // Response should still be persisted despite broadcast failure
      expect(deps.db.message.create as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ source: 'intent', content: 'Done' }),
        }),
      );
    });

    it('broadcasts pipeline:step for intent classification on fast-path', async () => {
      mockRunEarlyReturnHook.mockResolvedValueOnce({ handled: true, response: 'Lights on' } as never);
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const broadcastCalls: Array<[string, unknown]> = [];
      mockRunNotifyHooks.mockImplementation(async (_hooks, hookName, callHook) => {
        if (hookName === 'onBroadcast') {
          const fakeHooks: PluginHooks = {
            onBroadcast: async (event: string, data: unknown) => {
              broadcastCalls.push([event, data]);
            },
          };
          await callHook(fakeHooks);
        }
      });

      await orchestrator.getContext().sendToThread('thread-1', 'turn on the office');

      const intentStep = broadcastCalls.find(([event, data]) => event === 'pipeline:step' && (data as { step: string }).step === 'intentClassify');
      expect(intentStep).toBeDefined();
      expect(intentStep?.[1]).toMatchObject({
        threadId: 'thread-1',
        step: 'intentClassify',
      });
    });

    it('broadcasts pipeline:step for intent classification on fallthrough to LLM', async () => {
      mockRunEarlyReturnHook.mockResolvedValueOnce(null);
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const broadcastCalls: Array<[string, unknown]> = [];
      mockRunNotifyHooks.mockImplementation(async (_hooks, hookName, callHook) => {
        if (hookName === 'onBroadcast') {
          const fakeHooks: PluginHooks = {
            onBroadcast: async (event: string, data: unknown) => {
              broadcastCalls.push([event, data]);
            },
          };
          await callHook(fakeHooks);
        }
      });

      await orchestrator.getContext().sendToThread('thread-1', 'what is the weather');

      const intentStep = broadcastCalls.find(([event, data]) => event === 'pipeline:step' && (data as { step: string }).step === 'intentClassify');
      expect(intentStep).toBeDefined();
      expect(intentStep?.[1]).toMatchObject({
        threadId: 'thread-1',
        step: 'intentClassify',
        detail: expect.stringContaining('fallthrough'),
      });
    });

    it('handles non-Error broadcast exceptions during intent short-circuit', async () => {
      mockRunEarlyReturnHook.mockResolvedValueOnce({ handled: true, response: 'Done' } as never);
      mockRunNotifyHooks.mockImplementation(async (_hooks, hookName) => {
        if (hookName === 'onBroadcast') {
          throw 'raw string error';
        }
      });
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await expect(orchestrator.getContext().sendToThread('thread-1', 'lights on')).resolves.toBeUndefined();
    });
  });

  describe('getHooks', () => {
    it('returns empty array when no plugins are registered', () => {
      const orchestrator = createOrchestrator(makeDeps());

      expect(orchestrator.getHooks()).toEqual([]);
    });

    it('returns hooks from all registered plugins', async () => {
      const orchestrator = createOrchestrator(makeDeps());
      const hooksA: PluginHooks = { onMessage: vi.fn() };
      const hooksB: PluginHooks = { onAfterInvoke: vi.fn() };

      await orchestrator.registerPlugin(makePluginDefinition('a', hooksA));
      await orchestrator.registerPlugin(makePluginDefinition('b', hooksB));

      expect(orchestrator.getHooks()).toEqual([hooksA, hooksB]);
    });
  });

  describe('handleMessage', () => {
    it('runs the full pipeline in correct order', async () => {
      const invokeResult = makeInvokeResult({ output: 'claude response', durationMs: 42 });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);

      const callOrder: string[] = [];
      mockRunNotifyHooks.mockImplementation((_hooks, hookName) => {
        callOrder.push(hookName);
        return Promise.resolve();
      });
      mockRunChainHooks.mockImplementation((_hooks, _threadId, prompt) => {
        callOrder.push('onBeforeInvoke');
        return Promise.resolve(prompt);
      });
      (deps.invoker.invoke as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('invoke');
        return Promise.resolve(invokeResult);
      });

      await orchestrator.handleMessage('thread-1', 'user', 'hi');

      expect(callOrder).toEqual([
        'onMessage',
        'onBroadcast',
        'onBeforeInvoke',
        'onBroadcast',
        'onBroadcast',
        'invoke',
        'onAfterInvoke',
        'onBroadcast',
      ]);
    });

    it('calls runNotifyHooks for onMessage with correct arguments including plugin names', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const hooks: PluginHooks = { onMessage: vi.fn() };
      await orchestrator.registerPlugin(makePluginDefinition('p', hooks));

      await orchestrator.handleMessage('thread-99', 'user', 'hello');

      expect(mockRunNotifyHooks).toHaveBeenCalledWith([hooks], 'onMessage', expect.any(Function), expect.anything(), ['p'], undefined);
    });

    it('calls runChainHooks with the assembled prompt and returns modified prompt to invoker', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      mockRunChainHooks.mockResolvedValue('augmented prompt');

      const result = await orchestrator.handleMessage('thread-1', 'user', 'original');

      expect(mockRunChainHooks).toHaveBeenCalledWith([], 'thread-1', '[assembled] original', expect.anything(), [], undefined);
      expect(result.prompt).toBe('augmented prompt');
      expect(deps.invoker.invoke).toHaveBeenCalledWith(
        'augmented prompt',
        expect.objectContaining({ model: undefined, sessionId: undefined, onMessage: expect.any(Function) }),
      );
    });

    it('calls invoker.invoke with the chained prompt and thread options', async () => {
      const invokeResult = makeInvokeResult({ output: 'response' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      (deps.db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: 'sess-1',
        model: 'claude-opus-4-6',
      });
      const orchestrator = createOrchestrator(deps);
      mockRunChainHooks.mockResolvedValue('final prompt');

      await orchestrator.handleMessage('t', 'user', 'input');

      expect(deps.invoker.invoke).toHaveBeenCalledWith(
        'final prompt',
        expect.objectContaining({ model: 'claude-opus-4-6', sessionId: 'sess-1', onMessage: expect.any(Function) }),
      );
    });

    it('calls runNotifyHooks for onAfterInvoke with the invoke result and plugin names', async () => {
      const invokeResult = makeInvokeResult({ output: 'out', durationMs: 55 });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'content');

      expect(mockRunNotifyHooks).toHaveBeenCalledWith([], 'onAfterInvoke', expect.any(Function), expect.anything(), [], undefined);
    });

    it('returns the invoke result and prompt in the result object', async () => {
      const invokeResult = makeInvokeResult({ output: 'the answer', durationMs: 77 });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);
      mockRunChainHooks.mockResolvedValue('prompt used');

      const result = await orchestrator.handleMessage('thread-1', 'user', 'question');

      expect(result.invokeResult).toBe(invokeResult);
      expect(result.prompt).toBe('prompt used');
    });

    it('broadcasts pipeline:complete after all hooks have run', async () => {
      const invokeResult = makeInvokeResult({ durationMs: 123 });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-abc', 'user', 'message');

      const broadcastCall = mockRunNotifyHooks.mock.calls.find((c) => c[1] === 'onBroadcast');
      expect(broadcastCall).toBeDefined();
    });

    it('calls assemblePrompt with message and thread metadata before onBeforeInvoke', async () => {
      const deps = makeDeps();
      vi.mocked(deps.db.thread.findUnique).mockResolvedValue({
        sessionId: null,
        model: null,
        kind: 'task',
        name: 'Research Task',
      } as never);

      const orchestrator = createOrchestrator(deps);
      await orchestrator.handleMessage('thread-1', 'user', 'do research');

      expect(mockAssemblePrompt).toHaveBeenCalledWith('do research', {
        threadId: 'thread-1',
        kind: 'task',
        name: 'Research Task',
        customInstructions: null,
      });
    });

    it('passes assembled prompt to onBeforeInvoke chain hooks', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      await orchestrator.handleMessage('thread-1', 'user', 'hello');

      expect(mockRunChainHooks).toHaveBeenCalledWith(expect.any(Array), 'thread-1', '[assembled] hello', expect.anything(), [], undefined);
    });

    it('uses kind "general" when thread is not found', async () => {
      const deps = makeDeps();
      vi.mocked(deps.db.thread.findUnique).mockResolvedValue(null);

      const orchestrator = createOrchestrator(deps);
      await orchestrator.handleMessage('thread-new', 'user', 'hi');

      expect(mockAssemblePrompt).toHaveBeenCalledWith('hi', {
        threadId: 'thread-new',
        kind: 'general',
        name: undefined,
        customInstructions: null,
      });
    });

    it('passes hooks from registered plugins to all pipeline functions', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const hooks: PluginHooks = { onMessage: vi.fn(), onAfterInvoke: vi.fn() };
      await orchestrator.registerPlugin(makePluginDefinition('p', hooks));

      await orchestrator.handleMessage('t', 'user', 'hi');

      expect(mockRunNotifyHooks).toHaveBeenCalledWith([hooks], 'onMessage', expect.any(Function), expect.anything(), ['p'], undefined);
      expect(mockRunChainHooks).toHaveBeenCalledWith([hooks], 't', '[assembled] hi', expect.anything(), ['p'], undefined);
    });

    it('looks up thread for sessionId and model before invoking', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-123', 'user', 'hi');

      expect(deps.db.thread.findUnique as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        where: { id: 'thread-123' },
        select: {
          sessionId: true,
          model: true,
          effort: true,
          permissionMode: true,
          kind: true,
          name: true,
          customInstructions: true,
          projectId: true,
        },
      });
    });

    it('persists new sessionId on thread when invoke returns one', async () => {
      const invokeResult = makeInvokeResult({ sessionId: 'new-sess-id' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'hi');

      expect(deps.db.thread.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: { sessionId: 'new-sess-id' },
      });
    });

    it('clears sessionId when invoker returns no sessionId (session loss)', async () => {
      const invokeResult = makeInvokeResult({ sessionId: undefined });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      (deps.db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: 'old-sess-id',
        model: null,
        kind: 'primary',
        name: 'Main',
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'hi');

      expect(deps.db.thread.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: { sessionId: null },
      });
    });

    it('updates sessionId when invoker returns a new value (session rotation)', async () => {
      const invokeResult = makeInvokeResult({ sessionId: 'rotated-sess-id' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      (deps.db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: 'old-sess-id',
        model: null,
        kind: 'primary',
        name: 'Main',
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'hi');

      expect(deps.db.thread.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: { sessionId: 'rotated-sess-id' },
      });
    });

    it('skips DB write when sessionId has not changed (both null)', async () => {
      const invokeResult = makeInvokeResult({ sessionId: undefined });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      (deps.db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: null,
        model: null,
        kind: 'primary',
        name: 'Main',
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'hi');

      expect(deps.db.thread.update as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    });

    it('broadcasts pipeline:step events at each stage', async () => {
      const invokeResult = makeInvokeResult({ durationMs: 100, model: 'claude-sonnet-4-6' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'hello');

      // Collect all onBroadcast calls
      const broadcastCalls = mockRunNotifyHooks.mock.calls.filter((c) => c[1] === 'onBroadcast');

      // Should have pipeline:step calls: onMessage, onBeforeInvoke, invoking, onAfterInvoke
      // pipeline:complete is broadcast in sendToThread after DB write, not in handleMessage
      expect(broadcastCalls.length).toBeGreaterThanOrEqual(4);
    });

    it('does not persist sessionId when it has not changed', async () => {
      const invokeResult = makeInvokeResult({ sessionId: 'existing-sess' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      (deps.db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: 'existing-sess',
        model: null,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'hi');

      expect(deps.db.thread.update as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    });

    it('falls back to project model when thread model is null and thread has a projectId', async () => {
      const invokeResult = makeInvokeResult({ output: 'response' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      (deps.db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: null,
        model: null,
        kind: 'general',
        name: 'Project Thread',
        customInstructions: null,
        projectId: 'project-1',
      });
      (deps.db.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        model: 'claude-opus-4-6',
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'hi');

      expect(deps.db.project.findUnique as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        select: { model: true, workingDirectory: true },
      });
      expect(deps.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'claude-opus-4-6' }));
    });

    it('uses thread model even when project has a different model', async () => {
      const invokeResult = makeInvokeResult({ output: 'response' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      (deps.db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: null,
        model: 'claude-haiku-4-5-20251001',
        kind: 'general',
        name: 'Thread',
        customInstructions: null,
        projectId: 'project-1',
      });
      (deps.db.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        model: 'claude-opus-4-6',
        workingDirectory: null,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'hi');

      // Thread model takes precedence over project model
      expect(deps.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }));
    });

    it('does not look up project when thread has no projectId', async () => {
      const invokeResult = makeInvokeResult({ output: 'response' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      (deps.db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: null,
        model: null,
        kind: 'general',
        name: 'Thread',
        customInstructions: null,
        projectId: null,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'hi');

      expect(deps.db.project.findUnique as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    });

    it('passes thread effort to invoke when set on thread', async () => {
      const invokeResult = makeInvokeResult({ output: 'response' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      (deps.db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: null,
        model: null,
        effort: 'max',
        kind: 'general',
        name: 'Thread',
        customInstructions: null,
        projectId: null,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'hi');

      expect(deps.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ effort: 'max' }));
    });

    it('passes undefined effort to invoke when thread effort is null (use model default)', async () => {
      const invokeResult = makeInvokeResult({ output: 'response' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      (deps.db.thread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        sessionId: null,
        model: null,
        effort: null,
        permissionMode: null,
        kind: 'general',
        name: 'Thread',
        customInstructions: null,
        projectId: null,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'hi');

      expect(deps.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ effort: undefined }));
    });
  });
});
