import { PrismaClient } from '@harness/database';
import { createLogger } from '@harness/logger';
import type { InvokeResult, Invoker, OrchestratorConfig, PluginDefinition } from '@harness/plugin-contract';
import { createOrchestrator } from 'orchestrator';
import { type MockedFunction, vi } from 'vitest';

export type TestHarness = {
  orchestrator: ReturnType<typeof createOrchestrator>;
  prisma: PrismaClient;
  invoker: { invoke: MockedFunction<Invoker['invoke']> };
  threadId: string;
  cleanup: () => Promise<void>;
};

const makeTestConfig = (port = 0): OrchestratorConfig => ({
  databaseUrl: process.env['TEST_DATABASE_URL'] ?? '',
  timezone: 'UTC',
  maxConcurrentAgents: 3,
  claudeModel: 'claude-haiku-4-5-20251001',
  claudeTimeout: 10_000,
  discordToken: undefined,
  discordChannelId: undefined,
  port,
  logLevel: 'error',
});

export type CreateTestHarnessOpts = {
  invokerOutput?: string;
  invokerModel?: string;
  invokerTokens?: { inputTokens: number; outputTokens: number };
  port?: number;
};

export const createTestHarness = async (plugin: PluginDefinition, opts?: CreateTestHarnessOpts): Promise<TestHarness> => {
  const prisma = new PrismaClient({ datasourceUrl: process.env['TEST_DATABASE_URL'] });
  await prisma.$connect();

  const defaultResult: InvokeResult = {
    output: opts?.invokerOutput ?? 'ok',
    durationMs: 10,
    exitCode: 0,
    model: opts?.invokerModel ?? 'claude-haiku-4-5-20251001',
    inputTokens: opts?.invokerTokens?.inputTokens ?? 100,
    outputTokens: opts?.invokerTokens?.outputTokens ?? 50,
    sessionId: undefined,
  };

  const mockInvoke: MockedFunction<Invoker['invoke']> = vi.fn().mockResolvedValue(defaultResult);
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
