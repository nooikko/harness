import { plugin as metricsPlugin } from '@harness/plugin-metrics';
import { PrismaClient } from 'database';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env['TEST_DATABASE_URL'] });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('metrics plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('writes Metric rows with correct threadId, model, tokens, and costEstimate > 0 after handleMessage', async () => {
    harness = await createTestHarness(metricsPlugin, {
      invokerModel: 'claude-haiku-3.5-20241022',
      invokerTokens: { inputTokens: 200, outputTokens: 80 },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    const metrics = await prisma.metric.findMany({
      where: { threadId: harness.threadId },
      orderBy: { name: 'asc' },
    });

    expect(metrics.length).toBe(4);

    const byName = Object.fromEntries(metrics.map((m) => [m.name, m]));

    const inputMetric = byName['token.input'];
    const outputMetric = byName['token.output'];
    const totalMetric = byName['token.total'];
    const costMetric = byName['token.cost'];

    expect(inputMetric).toBeDefined();
    expect(inputMetric?.value).toBe(200);
    expect(inputMetric?.threadId).toBe(harness.threadId);
    expect((inputMetric?.tags as { model: string } | null)?.model).toBe('claude-haiku-3.5-20241022');

    expect(outputMetric).toBeDefined();
    expect(outputMetric?.value).toBe(80);

    expect(totalMetric).toBeDefined();
    expect(totalMetric?.value).toBe(280);

    expect(costMetric).toBeDefined();
    expect(costMetric?.value).toBeGreaterThan(0);
  });

  it('does not write any Metric row when the invoker returns model: undefined', async () => {
    harness = await createTestHarness(metricsPlugin, {
      invokerTokens: { inputTokens: 100, outputTokens: 50 },
    });

    // Override the mock to return undefined model — harness default falls back to a string,
    // so we must post-override to exercise the guard in the metrics plugin.
    harness.invoker.invoke.mockResolvedValue({
      output: 'ok',
      durationMs: 10,
      exitCode: 0,
      model: undefined,
      inputTokens: 100,
      outputTokens: 50,
      sessionId: undefined,
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    const metrics = await prisma.metric.findMany({
      where: { threadId: harness.threadId },
    });

    expect(metrics.length).toBe(0);
  });

  it('does not write any Metric row when invoker returns inputTokens and outputTokens undefined', async () => {
    harness = await createTestHarness(metricsPlugin, {
      invokerModel: 'claude-haiku-3.5-20241022',
    });

    // Override the mock to return undefined tokens
    harness.invoker.invoke.mockResolvedValue({
      output: 'ok',
      durationMs: 10,
      exitCode: 0,
      model: 'claude-haiku-3.5-20241022',
      inputTokens: undefined,
      outputTokens: undefined,
      sessionId: undefined,
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    const metrics = await prisma.metric.findMany({
      where: { threadId: harness.threadId },
    });

    expect(metrics.length).toBe(0);
  });
});
