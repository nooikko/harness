import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { setProjectInstructions } from '../set-project-instructions';

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

describe('setProjectInstructions', () => {
  it('updates instructions and returns success', async () => {
    const ctx = createMockContext();
    const updatedAt = new Date('2026-01-01T00:00:00Z');
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'proj-1',
      project: { updatedAt },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockResolvedValue({ count: 1 } as never);

    const result = await setProjectInstructions(ctx, { instructions: 'New instructions' }, meta);

    expect(result).toBe('Project instructions updated.');
    expect(ctx.db.project.updateMany).toHaveBeenCalledWith({
      where: { id: 'proj-1', updatedAt },
      data: { instructions: 'New instructions' },
    });
  });

  it('returns error for non-string input', async () => {
    const ctx = createMockContext();

    const result = await setProjectInstructions(ctx, { instructions: 42 }, meta);

    expect(result).toBe('(invalid input: instructions must be a string)');
  });

  it('returns error for missing input', async () => {
    const ctx = createMockContext();

    const result = await setProjectInstructions(ctx, {}, meta);

    expect(result).toBe('(invalid input: instructions must be a string)');
  });

  it('returns error for null input', async () => {
    const ctx = createMockContext();

    const result = await setProjectInstructions(ctx, null as never, meta);

    expect(result).toBe('(invalid input: instructions must be a string)');
  });

  it('returns error when thread not found', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue(null);

    const result = await setProjectInstructions(ctx, { instructions: 'x' }, meta);

    expect(result).toBe('(thread not found)');
  });

  it('returns error when thread has no project', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: null,
      project: null,
    } as never);

    const result = await setProjectInstructions(ctx, { instructions: 'x' }, meta);

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

    const result = await setProjectInstructions(ctx, { instructions: 'x' }, meta);

    expect(result).toContain('modified concurrently');
  });

  it('handles deleted project', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'proj-1',
      project: { updatedAt: new Date() },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(ctx.db.project.findUnique).mockResolvedValue(null);

    const result = await setProjectInstructions(ctx, { instructions: 'x' }, meta);

    expect(result).toContain('project was deleted');
  });

  it('handles database error on update', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'proj-1',
      project: { updatedAt: new Date() },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockRejectedValue(new Error('db down'));

    const result = await setProjectInstructions(ctx, { instructions: 'x' }, meta);

    expect(result).toContain('database error');
  });

  it('allows empty string to clear instructions', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'proj-1',
      project: { updatedAt: new Date() },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockResolvedValue({ count: 1 } as never);

    const result = await setProjectInstructions(ctx, { instructions: '' }, meta);

    expect(result).toBe('Project instructions updated.');
  });
});
