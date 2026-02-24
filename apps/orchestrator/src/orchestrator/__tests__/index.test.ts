import type { Logger } from '@harness/logger';
import type { InvokeResult, Invoker, OrchestratorConfig, PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import type { PrismaClient } from 'database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrchestratorDeps } from '../index';
import { createOrchestrator } from '../index';

vi.mock('../_helpers/parse-commands', () => ({
  parseCommands: vi.fn().mockReturnValue([]),
}));

vi.mock('../_helpers/run-chain-hooks', () => ({
  runChainHooks: vi.fn().mockImplementation((_hooks, _threadId, prompt) => Promise.resolve(prompt)),
}));

vi.mock('../_helpers/run-command-hooks', () => ({
  runCommandHooks: vi.fn().mockResolvedValue(false),
}));

vi.mock('../_helpers/run-notify-hooks', () => ({
  runNotifyHooks: vi.fn().mockResolvedValue(undefined),
}));

import { parseCommands } from '../_helpers/parse-commands';
import { runChainHooks } from '../_helpers/run-chain-hooks';
import { runCommandHooks } from '../_helpers/run-command-hooks';
import { runNotifyHooks } from '../_helpers/run-notify-hooks';

const mockParseCommands = vi.mocked(parseCommands);
const mockRunChainHooks = vi.mocked(runChainHooks);
const mockRunCommandHooks = vi.mocked(runCommandHooks);
const mockRunNotifyHooks = vi.mocked(runNotifyHooks);

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
};

const makeDeps = (overrides?: Partial<OrchestratorDeps>): OrchestratorDeps => ({
  db: {
    message: { create: vi.fn().mockResolvedValue({}) },
    thread: { update: vi.fn().mockResolvedValue({}) },
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
    mockParseCommands.mockReturnValue([]);
    mockRunChainHooks.mockImplementation((_hooks, _threadId, prompt) => Promise.resolve(prompt));
    mockRunCommandHooks.mockResolvedValue(false);
    mockRunNotifyHooks.mockResolvedValue(undefined);
  });

  describe('registerPlugin', () => {
    it('calls definition.register with the plugin context', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const definition = makePluginDefinition('test-plugin');

      await orchestrator.registerPlugin(definition);

      expect(definition.register).toHaveBeenCalledTimes(1);
      const passedContext = (definition.register as ReturnType<typeof vi.fn>).mock.calls[0]![0] as PluginContext;
      expect(passedContext).toHaveProperty('db', deps.db);
      expect(passedContext).toHaveProperty('invoker', deps.invoker);
      expect(passedContext).toHaveProperty('config', deps.config);
      expect(passedContext).toHaveProperty('logger', deps.logger);
      expect(typeof passedContext.sendToThread).toBe('function');
      expect(typeof passedContext.broadcast).toBe('function');
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
      expect(passedContext).toHaveProperty('db', deps.db);
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
      const invokeResult = makeInvokeResult({ output: 'assistant reply', durationMs: 50 });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);
      const context = orchestrator.getContext();

      await context.sendToThread('thread-1', 'hello');

      expect(deps.invoker.invoke).toHaveBeenCalled();
      expect(deps.db.message.create as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        data: { threadId: 'thread-1', role: 'assistant', content: 'assistant reply' },
      });
      expect(deps.db.thread.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        where: { id: 'thread-1' },
        data: { lastActivity: expect.any(Date) },
      });
    });

    it('does not persist when invoke returns empty output', async () => {
      const invokeResult = makeInvokeResult({ output: '' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);
      const context = orchestrator.getContext();

      await context.sendToThread('thread-1', 'hello');

      expect(deps.db.message.create as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
      expect(deps.db.thread.update as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
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

      expect(callOrder).toEqual(['onMessage', 'onBeforeInvoke', 'invoke', 'onAfterInvoke', 'onBroadcast']);
    });

    it('calls runNotifyHooks for onMessage with correct arguments', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const hooks: PluginHooks = { onMessage: vi.fn() };
      await orchestrator.registerPlugin(makePluginDefinition('p', hooks));

      await orchestrator.handleMessage('thread-99', 'user', 'hello');

      expect(mockRunNotifyHooks).toHaveBeenCalledWith([hooks], 'onMessage', expect.any(Function), deps.logger);
    });

    it('calls runChainHooks with the original content and returns modified prompt to invoker', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      mockRunChainHooks.mockResolvedValue('augmented prompt');

      const result = await orchestrator.handleMessage('thread-1', 'user', 'original');

      expect(mockRunChainHooks).toHaveBeenCalledWith([], 'thread-1', 'original', deps.logger);
      expect(result.prompt).toBe('augmented prompt');
      expect(deps.invoker.invoke).toHaveBeenCalledWith('augmented prompt');
    });

    it('calls invoker.invoke with the chained prompt', async () => {
      const invokeResult = makeInvokeResult({ output: 'response' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);
      mockRunChainHooks.mockResolvedValue('final prompt');

      await orchestrator.handleMessage('t', 'user', 'input');

      expect(deps.invoker.invoke).toHaveBeenCalledWith('final prompt');
    });

    it('calls runNotifyHooks for onAfterInvoke with the invoke result', async () => {
      const invokeResult = makeInvokeResult({ output: 'out', durationMs: 55 });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);

      await orchestrator.handleMessage('thread-1', 'user', 'content');

      expect(mockRunNotifyHooks).toHaveBeenCalledWith([], 'onAfterInvoke', expect.any(Function), deps.logger);
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

    it('parses commands from invoke output and calls runCommandHooks for each', async () => {
      const invokeResult = makeInvokeResult({ output: '/delegate task-1\n/notify done' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);
      mockParseCommands.mockReturnValue([
        { command: 'delegate', args: 'task-1' },
        { command: 'notify', args: 'done' },
      ]);
      mockRunCommandHooks.mockResolvedValue(true);

      const result = await orchestrator.handleMessage('thread-1', 'user', 'go');

      expect(mockParseCommands).toHaveBeenCalledWith(invokeResult.output);
      expect(mockRunCommandHooks).toHaveBeenCalledTimes(2);
      expect(mockRunCommandHooks).toHaveBeenCalledWith([], 'thread-1', 'delegate', 'task-1', deps.logger);
      expect(mockRunCommandHooks).toHaveBeenCalledWith([], 'thread-1', 'notify', 'done', deps.logger);
      expect(result.commandsHandled).toEqual(['delegate', 'notify']);
    });

    it('does not add command to commandsHandled when no hook handles it', async () => {
      const invokeResult = makeInvokeResult({ output: '/unknown-cmd' });
      const deps = makeDeps({
        invoker: { invoke: vi.fn().mockResolvedValue(invokeResult) } as unknown as Invoker,
      });
      const orchestrator = createOrchestrator(deps);
      mockParseCommands.mockReturnValue([{ command: 'unknown-cmd', args: '' }]);
      mockRunCommandHooks.mockResolvedValue(false);

      const result = await orchestrator.handleMessage('t', 'user', 'input');

      expect(result.commandsHandled).toEqual([]);
      expect(deps.logger.warn).toHaveBeenCalledWith('Unhandled command: /unknown-cmd [thread=t]');
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

    it('returns empty commandsHandled when invoke output has no commands', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      mockParseCommands.mockReturnValue([]);

      const result = await orchestrator.handleMessage('t', 'user', 'hi');

      expect(result.commandsHandled).toEqual([]);
    });

    it('passes hooks from registered plugins to all pipeline functions', async () => {
      const deps = makeDeps();
      const orchestrator = createOrchestrator(deps);
      const hooks: PluginHooks = { onMessage: vi.fn(), onAfterInvoke: vi.fn() };
      await orchestrator.registerPlugin(makePluginDefinition('p', hooks));

      await orchestrator.handleMessage('t', 'user', 'hi');

      expect(mockRunNotifyHooks).toHaveBeenCalledWith([hooks], 'onMessage', expect.any(Function), deps.logger);
      expect(mockRunChainHooks).toHaveBeenCalledWith([hooks], 't', 'hi', deps.logger);
    });
  });
});
