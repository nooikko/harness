// Tests for create-task-thread helper

import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { createTaskThread } from '../create-task-thread';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () =>
  ({
    db: {
      thread: {
        create: vi.fn().mockResolvedValue({ id: 'thread-abc-123' }),
      },
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }) as unknown as PluginContext;

describe('createTaskThread', () => {
  it('creates a thread with delegation source', async () => {
    const ctx = createMockContext();

    await createTaskThread(ctx, 'parent-1', 'Do research');

    const createCall = (ctx.db as unknown as { thread: { create: ReturnType<typeof vi.fn> } }).thread.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data.source).toBe('delegation');
  });

  it('links thread to parent via parentThreadId', async () => {
    const ctx = createMockContext();

    await createTaskThread(ctx, 'parent-thread-99', 'Build feature');

    const createCall = (ctx.db as unknown as { thread: { create: ReturnType<typeof vi.fn> } }).thread.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data.parentThreadId).toBe('parent-thread-99');
  });

  it('returns the created thread id', async () => {
    const ctx = createMockContext();

    const result = await createTaskThread(ctx, 'parent-1', 'Do work');

    expect(result.threadId).toBe('thread-abc-123');
  });

  it('sets thread kind to task', async () => {
    const ctx = createMockContext();

    await createTaskThread(ctx, 'parent-1', 'Do work');

    const createCall = (ctx.db as unknown as { thread: { create: ReturnType<typeof vi.fn> } }).thread.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data.kind).toBe('task');
  });

  it('sets thread status to active', async () => {
    const ctx = createMockContext();

    await createTaskThread(ctx, 'parent-1', 'Do work');

    const createCall = (ctx.db as unknown as { thread: { create: ReturnType<typeof vi.fn> } }).thread.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data.status).toBe('active');
  });

  it('truncates long prompts in the thread name', async () => {
    const ctx = createMockContext();
    const longPrompt = 'A'.repeat(200);

    await createTaskThread(ctx, 'parent-1', longPrompt);

    const createCall = (ctx.db as unknown as { thread: { create: ReturnType<typeof vi.fn> } }).thread.create.mock.calls[0]?.[0] as {
      data: { name: string };
    };
    expect(createCall.data.name.length).toBeLessThan(100);
    expect(createCall.data.name).toContain('Task: ');
  });

  it('generates a unique sourceId', async () => {
    const ctx = createMockContext();

    await createTaskThread(ctx, 'parent-1', 'Do work');

    const createCall = (ctx.db as unknown as { thread: { create: ReturnType<typeof vi.fn> } }).thread.create.mock.calls[0]?.[0] as {
      data: { sourceId: string };
    };
    expect(createCall.data.sourceId).toMatch(/^task-\d+-[a-z0-9]+$/);
  });

  it('sets lastActivity to a Date instance', async () => {
    const ctx = createMockContext();

    await createTaskThread(ctx, 'parent-1', 'Do work');

    const createCall = (ctx.db as unknown as { thread: { create: ReturnType<typeof vi.fn> } }).thread.create.mock.calls[0]?.[0] as {
      data: { lastActivity: unknown };
    };
    expect(createCall.data.lastActivity).toBeInstanceOf(Date);
  });
});
