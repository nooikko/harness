import { PrismaClient } from '@harness/database';
import { plugin as activityPlugin } from '@harness/plugin-activity';
import type { InvokeOptions } from '@harness/plugin-contract';
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

describe('activity plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('writes a pipeline_start status message to DB when pipeline starts', async () => {
    harness = await createTestHarness(activityPlugin);

    // sendToThread (not handleMessage) is required here because onPipelineStart/onPipelineComplete
    // hooks fire only from sendToThread — they are the outer envelope around the 8-step pipeline.
    // Using handleMessage directly would skip these hooks and silently make all four tests pass
    // vacuously (no DB rows written, but no assertion would catch it).
    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'hello');

    const statusMessages = await prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'status', source: 'pipeline' },
    });

    const startMsg = statusMessages.find((m) => (m.metadata as Record<string, unknown> | null)?.['event'] === 'pipeline_start');

    expect(startMsg).toBeDefined();
    expect(startMsg!.role).toBe('system');
    expect(startMsg!.kind).toBe('status');
    expect(startMsg!.source).toBe('pipeline');
  });

  it('writes pipeline step messages (onMessage, onBeforeInvoke, invoking, onAfterInvoke) to DB', async () => {
    harness = await createTestHarness(activityPlugin);

    // See comment in first test: sendToThread required (not handleMessage) for pipeline hooks.
    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'hello');

    const stepMessages = await prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'pipeline_step' },
    });

    expect(stepMessages.length).toBeGreaterThanOrEqual(4);

    const stepNames = stepMessages.map((m) => (m.metadata as Record<string, unknown> | null)?.['step'] as string);

    expect(stepNames).toContain('onMessage');
    expect(stepNames).toContain('onBeforeInvoke');
    expect(stepNames).toContain('invoking');
    expect(stepNames).toContain('onAfterInvoke');
  });

  it('writes a pipeline_complete status message to DB when pipeline finishes', async () => {
    harness = await createTestHarness(activityPlugin);

    // See comment in first test: sendToThread required (not handleMessage) for pipeline hooks.
    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'hello');

    const statusMessages = await prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'status', source: 'pipeline' },
    });

    const completeMsg = statusMessages.find((m) => (m.metadata as Record<string, unknown> | null)?.['event'] === 'pipeline_complete');

    expect(completeMsg).toBeDefined();
    expect(completeMsg!.role).toBe('system');
    expect(completeMsg!.kind).toBe('status');
    expect(completeMsg!.source).toBe('pipeline');
  });

  it('writes a thinking stream event to DB when the invoker emits a thinking event', async () => {
    harness = await createTestHarness(activityPlugin);

    harness.invoker.invoke.mockImplementation(async (_prompt, opts) => {
      const onMessage = (opts as InvokeOptions | undefined)?.onMessage;
      onMessage?.({
        type: 'thinking',
        content: 'Let me reason about this...',
        timestamp: Date.now(),
      });
      return {
        output: 'ok',
        durationMs: 10,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 100,
        outputTokens: 50,
        sessionId: undefined,
      };
    });

    // See comment in first test: sendToThread required (not handleMessage) for pipeline hooks.
    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'hello');

    const thinkingMessages = await prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'thinking' },
    });

    expect(thinkingMessages.length).toBeGreaterThanOrEqual(1);
    expect(thinkingMessages[0]!.content).toBe('Let me reason about this...');
    expect(thinkingMessages[0]!.role).toBe('assistant');
    expect(thinkingMessages[0]!.source).toBe('builtin');
  });
});
