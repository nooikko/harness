import { PrismaClient } from '@harness/database';
import { createLogger } from '@harness/logger';
import type { InvokeResult, Invoker, OrchestratorConfig, PluginDefinition } from '@harness/plugin-contract';
import { createOrchestrator } from 'orchestrator';
import { type MockedFunction, vi } from 'vitest';
import { requireTestDatabaseUrl } from '../setup/require-test-db';

export type TestHarness = {
  orchestrator: ReturnType<typeof createOrchestrator>;
  prisma: PrismaClient;
  invoker: { invoke: MockedFunction<Invoker['invoke']> };
  threadId: string;
  cleanup: () => Promise<void>;
};

const makeTestConfig = (port = 0): OrchestratorConfig => ({
  databaseUrl: requireTestDatabaseUrl(),
  timezone: 'UTC',
  maxConcurrentAgents: 3,
  claudeModel: 'claude-haiku-4-5-20251001',
  claudeTimeout: 10_000,
  discordToken: undefined,
  discordChannelId: undefined,
  port,
  logLevel: 'error',
  uploadDir: '/tmp/test-uploads',
});

export type CreateTestHarnessOpts = {
  invokerOutput?: string;
  invokerModel?: string;
  invokerTokens?: { inputTokens: number; outputTokens: number };
  port?: number;
};

const makeDefaultResult = (opts?: CreateTestHarnessOpts): InvokeResult => ({
  output: opts?.invokerOutput ?? 'ok',
  durationMs: 10,
  exitCode: 0,
  model: opts?.invokerModel ?? 'claude-haiku-4-5-20251001',
  inputTokens: opts?.invokerTokens?.inputTokens ?? 100,
  outputTokens: opts?.invokerTokens?.outputTokens ?? 50,
  sessionId: undefined,
});

export const createTestHarness = async (plugin: PluginDefinition, opts?: CreateTestHarnessOpts): Promise<TestHarness> => {
  const prisma = new PrismaClient({ datasourceUrl: requireTestDatabaseUrl() });
  await prisma.$connect();

  const mockInvoke: MockedFunction<Invoker['invoke']> = vi.fn().mockResolvedValue(makeDefaultResult(opts));
  const invoker: Invoker = { invoke: mockInvoke };

  const logger = createLogger('integration-test');
  const config = makeTestConfig(opts?.port ?? 0);

  const orchestrator = createOrchestrator({
    db: prisma,
    invoker,
    config,
    logger,
  });

  await orchestrator.registerPlugin(plugin);
  await orchestrator.start();

  const sourceId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const thread = await prisma.thread.create({
    data: {
      name: 'Integration Test Thread',
      kind: 'primary',
      source: 'integration-test',
      sourceId,
    },
  });

  return {
    orchestrator,
    prisma,
    invoker: { invoke: mockInvoke },
    threadId: thread.id,
    cleanup: async (): Promise<void> => {
      await orchestrator.stop();
      await prisma.$disconnect();
    },
  };
};

export type CreateMultiPluginHarnessOpts = CreateTestHarnessOpts & {
  /**
   * Called after all plugins are registered but before start(). Useful for
   * wiring delegation state hooks or other post-registration setup.
   */
  afterRegister?: (orchestrator: ReturnType<typeof createOrchestrator>) => void | Promise<void>;
};

/**
 * Multi-plugin variant of createTestHarness. Accepts an ordered array of
 * PluginDefinitions and registers them all before calling start(). The
 * returned harness shape is identical to TestHarness.
 *
 * Use `afterRegister` to wire delegation state hooks after all plugins register:
 *   afterRegister: (orch) => delegationState.setHooks!(orch.getHooks())
 */
export const createMultiPluginHarness = async (pluginDefs: PluginDefinition[], opts?: CreateMultiPluginHarnessOpts): Promise<TestHarness> => {
  const prisma = new PrismaClient({ datasourceUrl: requireTestDatabaseUrl() });
  await prisma.$connect();

  const mockInvoke: MockedFunction<Invoker['invoke']> = vi.fn().mockResolvedValue(makeDefaultResult(opts));
  const invoker: Invoker = { invoke: mockInvoke };
  const logger = createLogger('integration-test');
  const config = makeTestConfig(opts?.port ?? 0);

  const orchestrator = createOrchestrator({ db: prisma, invoker, config, logger });

  for (const definition of pluginDefs) {
    await orchestrator.registerPlugin(definition);
  }

  await opts?.afterRegister?.(orchestrator);

  await orchestrator.start();

  const sourceId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const thread = await prisma.thread.create({
    data: {
      name: 'Integration Test Thread',
      kind: 'primary',
      source: 'integration-test',
      sourceId,
    },
  });

  return {
    orchestrator,
    prisma,
    invoker: { invoke: mockInvoke },
    threadId: thread.id,
    cleanup: async (): Promise<void> => {
      await orchestrator.stop();
      await prisma.$disconnect();
    },
  };
};
