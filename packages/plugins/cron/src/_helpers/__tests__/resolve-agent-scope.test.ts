import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { resolveAgentScope } from '../resolve-agent-scope';

type CreateMockContext = (threadResult: unknown) => PluginContext;

const createMockContext: CreateMockContext = (threadResult) =>
  ({
    db: {
      thread: {
        findUnique: vi.fn().mockResolvedValue(threadResult),
      },
    } as never,
  }) as never;

const defaultMeta: PluginToolMeta = { threadId: 'thread-1' };

describe('resolveAgentScope', () => {
  it('returns agentId when thread exists and has an agent', async () => {
    const ctx = createMockContext({ agentId: 'agent-1' });

    const result = await resolveAgentScope(ctx, defaultMeta);

    expect(result).toEqual({ ok: true, scope: { agentId: 'agent-1' } });
  });

  it('queries thread by meta.threadId', async () => {
    const ctx = createMockContext({ agentId: 'agent-1' });

    await resolveAgentScope(ctx, { threadId: 'specific-thread' });

    const db = ctx.db as unknown as {
      thread: { findUnique: ReturnType<typeof vi.fn> };
    };
    expect(db.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'specific-thread' },
      select: { agentId: true },
    });
  });

  it('returns error when thread not found', async () => {
    const ctx = createMockContext(null);

    const result = await resolveAgentScope(ctx, defaultMeta);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Error:');
    }
  });

  it('returns error when thread has no agent', async () => {
    const ctx = createMockContext({ agentId: null });

    const result = await resolveAgentScope(ctx, defaultMeta);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Error:');
    }
  });
});
