import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { setProjectDescription } from '../set-project-description';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () =>
  ({
    db: {
      thread: { findUnique: vi.fn() },
      project: { updateMany: vi.fn(), findUnique: vi.fn() },
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }) as never;

const meta: PluginToolMeta = { threadId: 'thread-1' };

describe('setProjectDescription', () => {
  it('updates description and returns success', async () => {
    const ctx = createMockContext();
    const updatedAt = new Date('2026-01-01T00:00:00Z');
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'proj-1',
      project: { updatedAt },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockResolvedValue({ count: 1 } as never);

    const result = await setProjectDescription(ctx, { description: 'New desc' }, meta);

    expect(result).toBe('Project description updated.');
    expect(ctx.db.project.updateMany).toHaveBeenCalledWith({
      where: { id: 'proj-1', updatedAt },
      data: { description: 'New desc' },
    });
  });

  it('returns error for non-string input', async () => {
    const ctx = createMockContext();

    const result = await setProjectDescription(ctx, { description: 42 }, meta);

    expect(result).toBe('(invalid input: description must be a string)');
  });

  it('returns error for missing input', async () => {
    const ctx = createMockContext();

    const result = await setProjectDescription(ctx, {}, meta);

    expect(result).toBe('(invalid input: description must be a string)');
  });

  it('returns error when thread not found', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue(null);

    const result = await setProjectDescription(ctx, { description: 'x' }, meta);

    expect(result).toBe('(thread not found)');
  });

  it('returns error when thread has no project', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: null,
      project: null,
    } as never);

    const result = await setProjectDescription(ctx, { description: 'x' }, meta);

    expect(result).toBe('(thread has no associated project)');
  });

  it('handles concurrent modification', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'proj-1',
      project: { updatedAt: new Date() },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(ctx.db.project.findUnique).mockResolvedValue({ id: 'proj-1' } as never);

    const result = await setProjectDescription(ctx, { description: 'x' }, meta);

    expect(result).toContain('modified concurrently');
  });

  it('handles database error', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'proj-1',
      project: { updatedAt: new Date() },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockRejectedValue(new Error('db down'));

    const result = await setProjectDescription(ctx, { description: 'x' }, meta);

    expect(result).toContain('database error');
  });
});
