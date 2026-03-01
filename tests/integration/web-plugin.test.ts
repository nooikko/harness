import { PrismaClient } from '@harness/database';
import { plugin as webPlugin } from '@harness/plugin-web';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('web plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('starts the HTTP server and responds to GET /api/health', async () => {
    harness = await createTestHarness(webPlugin, { port: 14_500 });
    const response = await fetch('http://localhost:14500/api/health');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('POST /api/chat accepts a request and returns 200', async () => {
    harness = await createTestHarness(webPlugin, { port: 14_501 });
    const response = await fetch('http://localhost:14501/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: harness.threadId, content: 'hello' }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean };
    expect(body.success).toBe(true);
    // Wait for the fire-and-forget pipeline to complete before cleanup() disconnects Prisma.
    // Without this, orchestrator.stop() races with an in-flight invoke() call and can
    // produce "Client already disconnected" errors on slower CI machines.
    await vi.waitFor(
      () => {
        expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);
      },
      { timeout: 10_000 },
    );
  });

  it('POST /api/chat triggers pipeline execution asynchronously', async () => {
    harness = await createTestHarness(webPlugin, { port: 14_502 });
    await fetch('http://localhost:14502/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: harness.threadId, content: 'trigger pipeline' }),
    });
    // Wait for the fire-and-forget pipeline to call the invoker
    await vi.waitFor(
      () => {
        expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);
      },
      { timeout: 10_000 },
    );
  });
});
