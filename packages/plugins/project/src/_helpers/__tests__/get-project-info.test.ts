import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { getProjectInfo } from '../get-project-info';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () =>
  ({
    db: {
      thread: { findUnique: vi.fn() },
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }) as never;

const meta: PluginToolMeta = { threadId: 'thread-1' };

describe('getProjectInfo', () => {
  it('returns project name, description, instructions, and workingDirectory', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      project: {
        name: 'Harness',
        description: 'An orchestrator',
        instructions: 'Be helpful',
        workingDirectory: '/home/user/harness',
      },
    } as never);

    const result = await getProjectInfo(ctx, {}, meta);

    expect(result).toContain('Harness');
    expect(result).toContain('An orchestrator');
    expect(result).toContain('Be helpful');
    expect(result).toContain('/home/user/harness');
  });

  it('shows (none) for null fields', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      project: {
        name: 'Empty Project',
        description: null,
        instructions: null,
        workingDirectory: null,
      },
    } as never);

    const result = await getProjectInfo(ctx, {}, meta);

    expect(result).toContain('Empty Project');
    expect(result).toMatch(/description.*none/is);
    expect(result).toMatch(/instructions.*none/is);
    expect(result).toMatch(/working.?directory.*none/is);
  });

  it('returns error when thread not found', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue(null);

    const result = await getProjectInfo(ctx, {}, meta);

    expect(result).toBe('(thread not found)');
  });

  it('returns error when thread has no project', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      project: null,
    } as never);

    const result = await getProjectInfo(ctx, {}, meta);

    expect(result).toBe('(thread has no associated project)');
  });

  it('queries with correct select fields', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      project: {
        name: 'Test',
        description: null,
        instructions: null,
        workingDirectory: null,
      },
    } as never);

    await getProjectInfo(ctx, {}, meta);

    expect(ctx.db.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      select: {
        project: {
          select: {
            name: true,
            description: true,
            instructions: true,
            workingDirectory: true,
          },
        },
      },
    });
  });
});
