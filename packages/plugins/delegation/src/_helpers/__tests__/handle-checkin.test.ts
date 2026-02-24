import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { handleCheckin } from '../handle-checkin';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () =>
  ({
    db: {
      thread: {
        findUnique: vi.fn().mockResolvedValue({
          parentThreadId: 'parent-thread-1',
        }),
      },
      message: {
        create: vi.fn().mockResolvedValue({}),
      },
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    broadcast: vi.fn().mockResolvedValue(undefined),
  }) as unknown as PluginContext;

describe('handleCheckin', () => {
  it('creates a system message in the parent thread', async () => {
    const ctx = createMockContext();

    const result = await handleCheckin(ctx, 'task-thread-1', 'Progress update: 50% done');

    expect(result).toBe(true);
    const messageCreate = (
      ctx.db as unknown as {
        message: { create: ReturnType<typeof vi.fn> };
      }
    ).message.create;
    expect(messageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        threadId: 'parent-thread-1',
        role: 'system',
        content: expect.stringContaining('Progress update: 50% done'),
        metadata: expect.objectContaining({
          type: 'task-checkin',
          sourceThreadId: 'task-thread-1',
        }),
      }),
    });
  });

  it('broadcasts task:checkin event', async () => {
    const ctx = createMockContext();

    await handleCheckin(ctx, 'task-thread-1', 'Almost done');

    expect(ctx.broadcast).toHaveBeenCalledWith('task:checkin', {
      sourceThreadId: 'task-thread-1',
      parentThreadId: 'parent-thread-1',
      message: 'Almost done',
    });
  });

  it('returns false for empty message', async () => {
    const ctx = createMockContext();

    const result = await handleCheckin(ctx, 'task-thread-1', '   ');

    expect(result).toBe(false);
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('empty checkin'));
  });

  it('returns false when thread has no parent', async () => {
    const ctx = createMockContext();
    (
      ctx.db as unknown as {
        thread: { findUnique: ReturnType<typeof vi.fn> };
      }
    ).thread.findUnique.mockResolvedValue({ parentThreadId: null });

    const result = await handleCheckin(ctx, 'orphan-thread', 'Hello');

    expect(result).toBe(false);
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('no parent'));
  });

  it('returns false when thread does not exist', async () => {
    const ctx = createMockContext();
    (
      ctx.db as unknown as {
        thread: { findUnique: ReturnType<typeof vi.fn> };
      }
    ).thread.findUnique.mockResolvedValue(null);

    const result = await handleCheckin(ctx, 'nonexistent', 'Hello');

    expect(result).toBe(false);
  });

  it('trims message content', async () => {
    const ctx = createMockContext();

    await handleCheckin(ctx, 'task-thread-1', '  padded message  ');

    const messageCreate = (
      ctx.db as unknown as {
        message: { create: ReturnType<typeof vi.fn> };
      }
    ).message.create;
    const callData = messageCreate.mock.calls[0]?.[0]?.data;
    expect(callData.content).toContain('padded message');
    expect(callData.content).not.toContain('  padded');
  });

  it('handles broadcast failure gracefully', async () => {
    const ctx = createMockContext();
    (ctx.broadcast as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('WS down'));

    const result = await handleCheckin(ctx, 'task-thread-1', 'Check-in');

    expect(result).toBe(true);
  });
});
