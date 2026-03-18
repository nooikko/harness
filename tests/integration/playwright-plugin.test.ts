import { PrismaClient } from '@harness/database';
import { plugin as playwrightPlugin } from '@harness/plugin-playwright';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { requireTestDatabaseUrl } from './setup/require-test-db';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: requireTestDatabaseUrl() });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('playwright plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('navigate tool loads a page and returns title and status', async () => {
    harness = await createTestHarness(playwrightPlugin);

    const ctx = harness.orchestrator.getContext();
    const tool = playwrightPlugin.tools!.find((t) => t.name === 'navigate')!;
    const result = await tool.handler(ctx, { url: 'https://example.com' }, { threadId: harness.threadId, traceId: 'test-trace' });

    expect(result).toContain('Navigated to:');
    expect(result).toContain('Example Domain');
    expect(result).toContain('Status: 200');
  });

  it('snapshot tool returns accessibility tree after navigation', async () => {
    harness = await createTestHarness(playwrightPlugin);

    const ctx = harness.orchestrator.getContext();
    const navigateTool = playwrightPlugin.tools!.find((t) => t.name === 'navigate')!;
    const snapshotTool = playwrightPlugin.tools!.find((t) => t.name === 'snapshot')!;

    await navigateTool.handler(ctx, { url: 'https://example.com' }, { threadId: harness.threadId, traceId: 'test-trace' });
    const result = await snapshotTool.handler(ctx, {}, { threadId: harness.threadId, traceId: 'test-trace' });

    expect(result).toContain('Example Domain');
    expect(result).toContain('heading');
  });

  it('navigate tool rejects private IPs', async () => {
    harness = await createTestHarness(playwrightPlugin);

    const ctx = harness.orchestrator.getContext();
    const tool = playwrightPlugin.tools!.find((t) => t.name === 'navigate')!;
    const result = await tool.handler(ctx, { url: 'http://127.0.0.1:8080' }, { threadId: harness.threadId, traceId: 'test-trace' });

    expect(result).toContain('Error:');
    expect(result).toContain('private/internal');
  });

  it('navigate tool rejects file:// scheme', async () => {
    harness = await createTestHarness(playwrightPlugin);

    const ctx = harness.orchestrator.getContext();
    const tool = playwrightPlugin.tools!.find((t) => t.name === 'navigate')!;
    const result = await tool.handler(ctx, { url: 'file:///etc/passwd' }, { threadId: harness.threadId, traceId: 'test-trace' });

    expect(result).toContain('Error:');
    expect(result).toContain('Blocked scheme');
  });

  it('click tool returns error for non-existent selector', async () => {
    harness = await createTestHarness(playwrightPlugin);

    const ctx = harness.orchestrator.getContext();
    const navigateTool = playwrightPlugin.tools!.find((t) => t.name === 'navigate')!;
    const clickTool = playwrightPlugin.tools!.find((t) => t.name === 'click')!;

    await navigateTool.handler(ctx, { url: 'https://example.com' }, { threadId: harness.threadId, traceId: 'test-trace' });
    const result = await clickTool.handler(ctx, { selector: '#non-existent-element' }, { threadId: harness.threadId, traceId: 'test-trace' });

    expect(result).toContain('Error clicking');
  });

  it('screenshot tool saves a file and returns its path', async () => {
    harness = await createTestHarness(playwrightPlugin);

    const ctx = harness.orchestrator.getContext();
    const navigateTool = playwrightPlugin.tools!.find((t) => t.name === 'navigate')!;
    const screenshotTool = playwrightPlugin.tools!.find((t) => t.name === 'screenshot')!;

    await navigateTool.handler(ctx, { url: 'https://example.com' }, { threadId: harness.threadId, traceId: 'test-trace' });
    const result = await screenshotTool.handler(ctx, {}, { threadId: harness.threadId, traceId: 'test-trace' });

    expect(result).toContain('Screenshot saved:');
    expect(result).toContain('auto-deleted');
    expect(result).toContain('.png');
  });

  it('click tool clicks a real link on example.com', async () => {
    harness = await createTestHarness(playwrightPlugin);

    const ctx = harness.orchestrator.getContext();
    const navigateTool = playwrightPlugin.tools!.find((t) => t.name === 'navigate')!;
    const clickTool = playwrightPlugin.tools!.find((t) => t.name === 'click')!;

    await navigateTool.handler(ctx, { url: 'https://example.com' }, { threadId: harness.threadId, traceId: 'test-trace' });
    const result = await clickTool.handler(ctx, { selector: 'a' }, { threadId: harness.threadId, traceId: 'test-trace' });

    expect(result).toBe('Clicked: a');
  });
});
