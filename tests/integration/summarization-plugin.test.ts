import { PrismaClient } from '@harness/database';
import { plugin as summarizationPlugin } from '@harness/plugin-summarization';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('summarization plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('triggers summarization at 50 messages', async () => {
    harness = await createTestHarness(summarizationPlugin);

    // Seed exactly 50 kind:'text' messages so countThreadMessages returns 50
    // when onAfterInvoke fires (assistant text is written AFTER onAfterInvoke)
    const messageData = Array.from({ length: 50 }, (_, i) => ({
      threadId: harness.threadId,
      role: i % 2 === 0 ? 'user' : 'assistant',
      kind: 'text' as const,
      content: `Message ${i + 1}`,
    }));
    await prisma.message.createMany({ data: messageData });

    // First invoke call is the main pipeline; second is the summarization background call
    harness.invoker.invoke
      .mockResolvedValueOnce({
        output: 'Regular response',
        durationMs: 10,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 100,
        outputTokens: 50,
        sessionId: undefined,
      })
      .mockResolvedValue({
        output: 'Summary of the conversation so far...',
        durationMs: 10,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 200,
        outputTokens: 100,
        sessionId: undefined,
      });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    // summarizeInBackground is fire-and-forget — wait for the summary record
    await vi.waitFor(
      async () => {
        const summaries = await prisma.message.findMany({
          where: { threadId: harness.threadId, kind: 'summary' },
        });
        expect(summaries.length).toBe(1);
        expect(summaries[0]!.role).toBe('assistant');
        expect(summaries[0]!.content).toBe('Summary of the conversation so far...');
      },
      { timeout: 10_000 },
    );
  });

  it('does not trigger summarization below 50 messages', async () => {
    harness = await createTestHarness(summarizationPlugin);

    // Seed 30 kind:'text' messages — not enough to trigger summarization
    const messageData = Array.from({ length: 30 }, (_, i) => ({
      threadId: harness.threadId,
      role: i % 2 === 0 ? 'user' : 'assistant',
      kind: 'text' as const,
      content: `Message ${i + 1}`,
    }));
    await prisma.message.createMany({ data: messageData });

    harness.invoker.invoke.mockResolvedValueOnce({
      output: 'Regular response',
      durationMs: 10,
      exitCode: 0,
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 100,
      outputTokens: 50,
      sessionId: undefined,
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    // Give fire-and-forget time to complete if it were to fire (it should not)
    await new Promise((r) => setTimeout(r, 500));

    const summaries = await prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'summary' },
    });
    expect(summaries.length).toBe(0);
  });

  it('does not trigger summarization at non-multiple of 50', async () => {
    harness = await createTestHarness(summarizationPlugin);

    // Seed 51 kind:'text' messages — not a multiple of 50
    const messageData = Array.from({ length: 51 }, (_, i) => ({
      threadId: harness.threadId,
      role: i % 2 === 0 ? 'user' : 'assistant',
      kind: 'text' as const,
      content: `Message ${i + 1}`,
    }));
    await prisma.message.createMany({ data: messageData });

    harness.invoker.invoke.mockResolvedValueOnce({
      output: 'Regular response',
      durationMs: 10,
      exitCode: 0,
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 100,
      outputTokens: 50,
      sessionId: undefined,
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    // Give fire-and-forget time to complete if it were to fire (it should not)
    await new Promise((r) => setTimeout(r, 500));

    const summaries = await prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'summary' },
    });
    expect(summaries.length).toBe(0);
  });
});
