import { PrismaClient } from '@harness/database';
import { plugin as outlookPlugin } from '@harness/plugin-outlook';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { requireTestDatabaseUrl } from './setup/require-test-db';
import { resetDatabase } from './setup/reset-db';

vi.mock('@harness/oauth', () => ({
  getValidToken: vi.fn().mockResolvedValue('test-access-token'),
}));

const prisma = new PrismaClient({ datasourceUrl: requireTestDatabaseUrl() });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const getTool = (name: string) => {
  const tool = outlookPlugin.tools!.find((t) => t.name === name)!;
  if (!tool) {
    throw new Error(`Tool "${name}" not found in outlook plugin`);
  }
  return tool;
};

const makeMeta = (threadId: string) => ({
  threadId,
  traceId: 'test-trace',
});

const mockGraphResponse = (body: unknown, status = 200) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
};

const mockGraph204 = () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 204 }));
};

describe('outlook plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    vi.restoreAllMocks();
    await harness?.cleanup();
  });

  it('search_emails returns formatted email results', async () => {
    harness = await createTestHarness(outlookPlugin);
    const ctx = harness.orchestrator.getContext();

    mockGraphResponse({
      value: [
        {
          id: 'msg-1',
          subject: 'Project Update',
          from: {
            emailAddress: { name: 'Alice', address: 'alice@example.com' },
          },
          receivedDateTime: '2026-03-17T10:00:00Z',
          bodyPreview: 'Here is the latest update on the project...',
        },
      ],
    });

    const tool = getTool('search_emails');
    const result = await tool.handler(ctx, { query: 'project update' }, makeMeta(harness.threadId));
    const text = typeof result === 'string' ? result : result.text;
    const parsed = JSON.parse(text);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].subject).toBe('Project Update');
    expect(parsed[0].from).toContain('alice@example.com');
  });

  it('search_emails returns message when no results', async () => {
    harness = await createTestHarness(outlookPlugin);
    const ctx = harness.orchestrator.getContext();

    mockGraphResponse({ value: [] });

    const tool = getTool('search_emails');
    const result = await tool.handler(ctx, { query: 'nonexistent' }, makeMeta(harness.threadId));

    expect(result).toContain('No emails found');
  });

  it('send_email sends POST to Graph API and returns confirmation', async () => {
    harness = await createTestHarness(outlookPlugin);
    const ctx = harness.orchestrator.getContext();

    mockGraph204();

    const tool = getTool('send_email');
    const result = await tool.handler(
      ctx,
      {
        to: ['bob@example.com'],
        subject: 'Hello',
        body: 'Hi Bob!',
      },
      makeMeta(harness.threadId),
    );

    expect(result).toContain('Email sent to bob@example.com');

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect(fetchCall[1]?.method).toBe('POST');
    expect(fetchCall[0]).toContain('/me/sendMail');
  });

  it('list_folders returns folder list', async () => {
    harness = await createTestHarness(outlookPlugin);
    const ctx = harness.orchestrator.getContext();

    mockGraphResponse({
      value: [
        {
          id: 'folder-1',
          displayName: 'Inbox',
          totalItemCount: 150,
          unreadItemCount: 3,
        },
        {
          id: 'folder-2',
          displayName: 'Sent Items',
          totalItemCount: 80,
          unreadItemCount: 0,
        },
      ],
    });

    const tool = getTool('list_folders');
    const result = await tool.handler(ctx, {}, makeMeta(harness.threadId));
    const text = typeof result === 'string' ? result : result.text;

    expect(text).toContain('Inbox');
    expect(text).toContain('Sent');
  });

  it('find_unsubscribe_links extracts unsubscribe URLs from emails', async () => {
    harness = await createTestHarness(outlookPlugin);
    const ctx = harness.orchestrator.getContext();

    mockGraphResponse({
      value: [
        {
          id: 'msg-spam-1',
          subject: 'Weekly Newsletter',
          from: {
            emailAddress: {
              name: 'Newsletter Co',
              address: 'news@company.com',
            },
          },
          body: {
            content: '<html><body><a href="https://company.com/unsubscribe?id=123">Unsubscribe</a></body></html>',
          },
        },
      ],
    });

    const tool = getTool('find_unsubscribe_links');
    const result = await tool.handler(ctx, {}, makeMeta(harness.threadId));
    const text = typeof result === 'string' ? result : result.text;
    const parsed = JSON.parse(text);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].sender).toContain('news@company.com');
    expect(parsed[0].unsubscribeLinks[0]).toContain('unsubscribe');
  });

  it('tool throws when Graph API returns error status', async () => {
    harness = await createTestHarness(outlookPlugin);
    const ctx = harness.orchestrator.getContext();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Forbidden', { status: 403, statusText: 'Forbidden' }));

    const tool = getTool('search_emails');
    await expect(tool.handler(ctx, { query: 'test' }, makeMeta(harness.threadId))).rejects.toThrow('Graph API error (403)');
  });
});
