import type { Logger } from '@harness/logger';
import type { OrchestratorConfig, PluginDefinition } from '@harness/plugin-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/logger', () => ({
  createLogger: vi.fn(),
}));

vi.mock('database', () => ({
  prisma: {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../config', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../invoker', () => ({
  createInvoker: vi.fn(),
}));

vi.mock('../plugin-registry', () => ({
  getPlugins: vi.fn(),
}));

vi.mock('../plugin-loader', () => ({
  createPluginLoader: vi.fn(),
}));

vi.mock('../orchestrator', () => ({
  createOrchestrator: vi.fn(),
}));

import { createLogger } from '@harness/logger';
import { prisma } from 'database';
import { loadConfig } from '../config';
import { boot, main } from '../index';
import { createInvoker } from '../invoker';
import { createOrchestrator } from '../orchestrator';
import { createPluginLoader } from '../plugin-loader';
import { getPlugins } from '../plugin-registry';

const mockCreateLogger = vi.mocked(createLogger);
const mockPrisma = vi.mocked(prisma);
const mockLoadConfig = vi.mocked(loadConfig);
const mockCreateInvoker = vi.mocked(createInvoker);
const mockGetPlugins = vi.mocked(getPlugins);
const mockCreatePluginLoader = vi.mocked(createPluginLoader);
const mockCreateOrchestrator = vi.mocked(createOrchestrator);

const makeLogger = (): Logger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

const makeConfig = (overrides?: Partial<OrchestratorConfig>): OrchestratorConfig => ({
  databaseUrl: 'postgres://localhost/test',
  timezone: 'UTC',
  maxConcurrentAgents: 3,
  claudeModel: 'sonnet',
  claudeTimeout: 300000,
  discordToken: undefined,
  discordChannelId: undefined,
  port: 3001,
  logLevel: 'info' as const,
  ...overrides,
});

const makePluginDefinition = (name: string, overrides?: Partial<PluginDefinition>): PluginDefinition => ({
  name,
  version: '1.0.0',
  register: vi.fn().mockResolvedValue({}),
  ...overrides,
});

type MockOrchestrator = {
  registerPlugin: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  getPlugins: ReturnType<typeof vi.fn>;
  getContext: ReturnType<typeof vi.fn>;
  getHooks: ReturnType<typeof vi.fn>;
  handleMessage: ReturnType<typeof vi.fn>;
};

const makeOrchestrator = (): MockOrchestrator => ({
  registerPlugin: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  getPlugins: vi.fn().mockReturnValue([]),
  getContext: vi.fn(),
  getHooks: vi.fn().mockReturnValue([]),
  handleMessage: vi.fn(),
});

type MockInvoker = {
  invoke: ReturnType<typeof vi.fn>;
};

const makeInvoker = (): MockInvoker => ({
  invoke: vi.fn(),
});

const setupDefaults = (options?: {
  plugins?: PluginDefinition[];
  orchestrator?: MockOrchestrator;
  config?: OrchestratorConfig;
}): { logger: Logger; orchestrator: MockOrchestrator; invoker: MockInvoker } => {
  const logger = makeLogger();
  const orchestrator = options?.orchestrator ?? makeOrchestrator();
  const invoker = makeInvoker();
  const config = options?.config ?? makeConfig();
  const plugins = options?.plugins ?? [];

  mockCreateLogger.mockReturnValue(logger);
  mockLoadConfig.mockReturnValue(config);
  mockCreateInvoker.mockReturnValue(invoker as ReturnType<typeof createInvoker>);
  mockGetPlugins.mockResolvedValue(plugins);
  mockCreatePluginLoader.mockReturnValue({
    loadAll: vi.fn().mockReturnValue({ loaded: plugins, results: [] }),
  });
  mockCreateOrchestrator.mockReturnValue(orchestrator as ReturnType<typeof createOrchestrator>);

  return { logger, orchestrator, invoker };
};

type SignalHandler = (...args: unknown[]) => void;

type GetSignalHandler = (handlers: Map<string, SignalHandler>, signal: string) => SignalHandler;

const getSignalHandler: GetSignalHandler = (handlers, signal) => {
  const handler = handlers.get(signal);
  if (!handler) {
    throw new Error(`No handler registered for ${signal}`);
  }
  return handler;
};

describe('boot', () => {
  let signalHandlers: Map<string, SignalHandler>;
  let originalProcessOn: typeof process.on;
  let originalProcessExit: typeof process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    signalHandlers = new Map();

    // Reset prisma mocks to default resolved values after clearAllMocks
    mockPrisma.$connect.mockResolvedValue(undefined);
    mockPrisma.$disconnect.mockResolvedValue(undefined);

    originalProcessOn = process.on;
    originalProcessExit = process.exit;

    process.on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      signalHandlers.set(event, handler);
      return process;
    }) as unknown as typeof process.on;

    process.exit = vi.fn() as unknown as typeof process.exit;
  });

  afterEach(() => {
    process.on = originalProcessOn;
    process.exit = originalProcessExit;
  });

  describe('initialization sequence', () => {
    it('creates a logger with the harness prefix', async () => {
      setupDefaults();

      await boot();

      expect(mockCreateLogger).toHaveBeenCalledWith('harness');
    });

    it('loads config before other initialization', async () => {
      const { logger } = setupDefaults();

      await boot();

      expect(mockLoadConfig).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Loading configuration');
    });

    it('connects to the database', async () => {
      setupDefaults();

      await boot();

      expect(mockPrisma.$connect).toHaveBeenCalledTimes(1);
    });

    it('creates an invoker with config values', async () => {
      const config = makeConfig({ claudeModel: 'opus', claudeTimeout: 60000 });
      setupDefaults({ config });

      await boot();

      expect(mockCreateInvoker).toHaveBeenCalledWith({
        defaultModel: 'opus',
        defaultTimeout: 60000,
      });
    });

    it('gets plugins from the static registry', async () => {
      setupDefaults();

      await boot();

      expect(mockGetPlugins).toHaveBeenCalledTimes(1);
    });

    it('validates plugins via the plugin loader', async () => {
      const plugins = [makePluginDefinition('test-plugin')];
      const { logger } = setupDefaults({ plugins });

      await boot();

      expect(mockCreatePluginLoader).toHaveBeenCalledWith({
        plugins,
        logger,
      });
    });

    it('creates the orchestrator with correct deps', async () => {
      const config = makeConfig();
      const { logger, invoker } = setupDefaults({ config });

      await boot();

      expect(mockCreateOrchestrator).toHaveBeenCalledWith({
        db: mockPrisma,
        invoker,
        config,
        logger,
      });
    });
  });

  describe('plugin lifecycle', () => {
    it('registers all loaded plugins with the orchestrator', async () => {
      const pluginA = makePluginDefinition('plugin-a');
      const pluginB = makePluginDefinition('plugin-b');
      const { orchestrator } = setupDefaults({ plugins: [pluginA, pluginB] });

      await boot();

      expect(orchestrator.registerPlugin).toHaveBeenCalledTimes(2);
      expect(orchestrator.registerPlugin).toHaveBeenCalledWith(pluginA);
      expect(orchestrator.registerPlugin).toHaveBeenCalledWith(pluginB);
    });

    it('calls orchestrator.start() after registering all plugins', async () => {
      const plugin = makePluginDefinition('test');
      const { orchestrator } = setupDefaults({ plugins: [plugin] });

      await boot();

      const registerOrder = orchestrator.registerPlugin.mock.invocationCallOrder[0] ?? 0;
      const startOrder = orchestrator.start.mock.invocationCallOrder[0] ?? 0;
      expect(registerOrder).toBeLessThan(startOrder);
    });

    it('boots with no plugins loaded', async () => {
      const { orchestrator } = setupDefaults({ plugins: [] });

      await boot();

      expect(orchestrator.registerPlugin).not.toHaveBeenCalled();
      expect(orchestrator.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('signal handlers', () => {
    it('registers SIGTERM handler', async () => {
      setupDefaults();

      await boot();

      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(signalHandlers.has('SIGTERM')).toBe(true);
    });

    it('registers SIGINT handler', async () => {
      setupDefaults();

      await boot();

      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(signalHandlers.has('SIGINT')).toBe(true);
    });

    it('calls orchestrator.stop() on SIGTERM', async () => {
      const { orchestrator } = setupDefaults();

      await boot();

      const handler = getSignalHandler(signalHandlers, 'SIGTERM');
      handler();

      // Wait for the async shutdown to complete
      await vi.waitFor(() => {
        expect(orchestrator.stop).toHaveBeenCalledTimes(1);
      });
    });

    it('disconnects the database on SIGTERM', async () => {
      setupDefaults();

      await boot();

      const handler = getSignalHandler(signalHandlers, 'SIGTERM');
      handler();

      await vi.waitFor(() => {
        expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
      });
    });

    it('calls process.exit(0) after successful shutdown', async () => {
      setupDefaults();

      await boot();

      const handler = getSignalHandler(signalHandlers, 'SIGINT');
      handler();

      await vi.waitFor(() => {
        expect(process.exit).toHaveBeenCalledWith(0);
      });
    });

    it('calls process.exit(1) when shutdown throws unexpectedly', async () => {
      const { logger } = setupDefaults();

      await boot();

      // Make logger.info throw on the next call (during shutdown) to trigger
      // the catch block in the signal handler
      (logger.info as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('unexpected logger failure');
      });

      const handler = getSignalHandler(signalHandlers, 'SIGTERM');
      handler();

      await vi.waitFor(() => {
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    it('handles non-Error thrown during signal shutdown', async () => {
      const { logger } = setupDefaults();

      await boot();

      // Throw a non-Error to cover the String(err) branch in signal handler catch
      (logger.info as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw 'raw string thrown';
      });

      const handler = getSignalHandler(signalHandlers, 'SIGINT');
      handler();

      await vi.waitFor(() => {
        expect(process.exit).toHaveBeenCalledWith(1);
      });
    });

    it('only shuts down once even if signal fires twice', async () => {
      const { orchestrator } = setupDefaults();

      const result = await boot();

      // Call shutdown directly twice
      await result.shutdown();
      await result.shutdown();

      expect(orchestrator.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('graceful shutdown', () => {
    it('returns a shutdown function', async () => {
      setupDefaults();

      const result = await boot();

      expect(typeof result.shutdown).toBe('function');
    });

    it('stops plugins during shutdown', async () => {
      const { orchestrator } = setupDefaults();

      const result = await boot();
      await result.shutdown();

      expect(orchestrator.stop).toHaveBeenCalledTimes(1);
    });

    it('disconnects database during shutdown', async () => {
      setupDefaults();

      const result = await boot();
      await result.shutdown();

      expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
    });

    it('logs shutdown progress', async () => {
      const { logger } = setupDefaults();

      const result = await boot();
      await result.shutdown();

      expect(logger.info).toHaveBeenCalledWith('Graceful shutdown initiated');
      expect(logger.info).toHaveBeenCalledWith('Stopping plugins');
      expect(logger.info).toHaveBeenCalledWith('Disconnecting database');
      expect(logger.info).toHaveBeenCalledWith('Shutdown complete');
    });

    it('continues shutdown even if orchestrator.stop() throws', async () => {
      const orchestrator = makeOrchestrator();
      orchestrator.stop.mockRejectedValue(new Error('stop failed'));
      const { logger } = setupDefaults({ orchestrator });

      const result = await boot();
      await result.shutdown();

      expect(logger.error).toHaveBeenCalledWith('Error stopping plugins', {
        error: 'stop failed',
      });
      expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Shutdown complete');
    });

    it('continues shutdown even if database disconnect throws', async () => {
      const { logger } = setupDefaults();
      mockPrisma.$disconnect.mockRejectedValue(new Error('disconnect failed'));

      const result = await boot();
      await result.shutdown();

      expect(logger.error).toHaveBeenCalledWith('Error disconnecting database', {
        error: 'disconnect failed',
      });
      expect(logger.info).toHaveBeenCalledWith('Shutdown complete');
    });

    it('handles non-Error objects thrown during plugin stop', async () => {
      const orchestrator = makeOrchestrator();
      orchestrator.stop.mockRejectedValue('string error');
      const { logger } = setupDefaults({ orchestrator });

      const result = await boot();
      await result.shutdown();

      expect(logger.error).toHaveBeenCalledWith('Error stopping plugins', {
        error: 'string error',
      });
    });

    it('handles non-Error objects thrown during database disconnect', async () => {
      const { logger } = setupDefaults();
      mockPrisma.$disconnect.mockRejectedValue('db string error');

      const result = await boot();
      await result.shutdown();

      expect(logger.error).toHaveBeenCalledWith('Error disconnecting database', {
        error: 'db string error',
      });
    });
  });

  describe('error handling during boot', () => {
    it('throws when loadConfig fails', async () => {
      const logger = makeLogger();
      mockCreateLogger.mockReturnValue(logger);
      mockLoadConfig.mockImplementation(() => {
        throw new Error('Missing DATABASE_URL');
      });

      await expect(boot()).rejects.toThrow('Missing DATABASE_URL');
    });

    it('throws when database connection fails', async () => {
      const logger = makeLogger();
      mockCreateLogger.mockReturnValue(logger);
      mockLoadConfig.mockReturnValue(makeConfig());
      mockPrisma.$connect.mockRejectedValue(new Error('connection refused'));

      await expect(boot()).rejects.toThrow('connection refused');
    });

    it('throws when plugin registration fails', async () => {
      const orchestrator = makeOrchestrator();
      orchestrator.registerPlugin.mockRejectedValue(new Error('register failed'));
      const plugins = [makePluginDefinition('broken')];
      setupDefaults({ plugins, orchestrator });

      await expect(boot()).rejects.toThrow('register failed');
    });

    it('throws when orchestrator.start() fails', async () => {
      const orchestrator = makeOrchestrator();
      orchestrator.start.mockRejectedValue(new Error('start failed'));
      setupDefaults({ orchestrator });

      await expect(boot()).rejects.toThrow('start failed');
    });
  });

  describe('logging', () => {
    it('logs orchestrator ready with plugin names and port', async () => {
      const pluginA = makePluginDefinition('context');
      const pluginB = makePluginDefinition('discord');
      const config = makeConfig({ port: 8080 });
      const { logger } = setupDefaults({ plugins: [pluginA, pluginB], config });

      await boot();

      expect(logger.info).toHaveBeenCalledWith('Orchestrator ready', {
        plugins: ['context', 'discord'],
        port: 8080,
      });
    });

    it('logs each stage of the boot process', async () => {
      const { logger } = setupDefaults();

      await boot();

      const logCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
      expect(logCalls).toContain('Loading configuration');
      expect(logCalls).toContain('Initializing database connection');
      expect(logCalls).toContain('Creating invoker');
      expect(logCalls).toContain('Loading plugins from registry');
      expect(logCalls).toContain('Validating plugins');
      expect(logCalls).toContain('Creating orchestrator');
      expect(logCalls).toContain('Registering plugins');
      expect(logCalls).toContain('Starting plugins');
      expect(logCalls).toContain('Orchestrator ready');
    });
  });
});

describe('main', () => {
  let originalProcessExit: typeof process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$connect.mockResolvedValue(undefined);
    mockPrisma.$disconnect.mockResolvedValue(undefined);

    originalProcessExit = process.exit;
    process.exit = vi.fn() as unknown as typeof process.exit;

    process.on = vi.fn(() => process) as unknown as typeof process.on;
  });

  afterEach(() => {
    process.exit = originalProcessExit;
  });

  it('calls process.exit(1) when boot throws', async () => {
    const logger = makeLogger();
    mockCreateLogger.mockReturnValue(logger);
    mockLoadConfig.mockImplementation(() => {
      throw new Error('config broken');
    });

    await main();

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('logs fatal error when boot throws', async () => {
    const logger = makeLogger();
    mockCreateLogger.mockReturnValue(logger);
    mockLoadConfig.mockImplementation(() => {
      throw new Error('config broken');
    });

    await main();

    expect(logger.error).toHaveBeenCalledWith('Fatal error during boot', {
      error: 'config broken',
    });
  });

  it('handles non-Error thrown during boot', async () => {
    const logger = makeLogger();
    mockCreateLogger.mockReturnValue(logger);
    mockLoadConfig.mockImplementation(() => {
      throw 'raw string boot error';
    });

    await main();

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith('Fatal error during boot', {
      error: 'raw string boot error',
    });
  });

  it('does not call process.exit on successful boot', async () => {
    const logger = makeLogger();
    const orchestrator = makeOrchestrator();
    const invoker = makeInvoker();
    const config = makeConfig();

    mockCreateLogger.mockReturnValue(logger);
    mockLoadConfig.mockReturnValue(config);
    mockCreateInvoker.mockReturnValue(invoker as ReturnType<typeof createInvoker>);
    mockGetPlugins.mockResolvedValue([]);
    mockCreatePluginLoader.mockReturnValue({
      loadAll: vi.fn().mockReturnValue({ loaded: [], results: [] }),
    });
    mockCreateOrchestrator.mockReturnValue(orchestrator as ReturnType<typeof createOrchestrator>);

    await main();

    expect(process.exit).not.toHaveBeenCalled();
  });
});
