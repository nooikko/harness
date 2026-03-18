import { describe, expect, it, vi } from 'vitest';
import { synthesizeUserInsight } from '../synthesize-user-insight';

const makeCtx = (existingMemories: Array<{ id: string; content: string }> = [], synthesisOutput?: string) => ({
  invoker: {
    invoke: vi.fn().mockResolvedValue({ output: synthesisOutput ?? '{"action": "create", "insight": "Synthesized insight"}' }),
  },
  db: {
    agentMemory: {
      findMany: vi.fn().mockResolvedValue(existingMemories),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
});

describe('synthesizeUserInsight', () => {
  it('writes fact directly when no existing SEMANTIC memories', async () => {
    const ctx = makeCtx([]);
    await synthesizeUserInsight(ctx as never, 'agent-1', 'Aria', 'has ADD');
    expect(ctx.invoker.invoke).not.toHaveBeenCalled();
    expect(ctx.db.agentMemory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentId: 'agent-1',
        content: 'has ADD',
        type: 'SEMANTIC',
        scope: 'AGENT',
        importance: 8,
      }),
    });
  });

  it('calls Haiku synthesis when existing memories exist', async () => {
    const existing = [{ id: 'mem-1', content: 'Prefers short responses' }];
    const ctx = makeCtx(
      existing,
      '{"action": "create", "insight": "User has ADD and prefers short responses — keep things concise and front-loaded"}',
    );
    await synthesizeUserInsight(ctx as never, 'agent-1', 'Aria', 'has ADD');
    expect(ctx.invoker.invoke).toHaveBeenCalledOnce();
    expect(ctx.db.agentMemory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: 'User has ADD and prefers short responses — keep things concise and front-loaded',
        type: 'SEMANTIC',
        scope: 'AGENT',
      }),
    });
  });

  it('skips writing when action is skip (duplicate detected)', async () => {
    const existing = [{ id: 'mem-1', content: 'has ADD' }];
    const ctx = makeCtx(existing, '{"action": "skip"}');
    await synthesizeUserInsight(ctx as never, 'agent-1', 'Aria', 'has ADD');
    expect(ctx.db.agentMemory.create).not.toHaveBeenCalled();
    expect(ctx.db.agentMemory.update).not.toHaveBeenCalled();
    expect(ctx.logger.debug).toHaveBeenCalledWith('User insight skipped (duplicate)', expect.any(Object));
  });

  it('updates in-place when action is update with valid supersedes ID', async () => {
    const existing = [{ id: 'mem-1', content: "Doesn't like chocolate" }];
    const ctx = makeCtx(existing, '{"action": "update", "insight": "Dislikes toffee specifically, not all chocolate", "supersedes": "mem-1"}');
    await synthesizeUserInsight(ctx as never, 'agent-1', 'Aria', 'actually likes chocolate but not toffee');
    expect(ctx.db.agentMemory.update).toHaveBeenCalledWith({
      where: { id: 'mem-1' },
      data: { content: 'Dislikes toffee specifically, not all chocolate' },
    });
    expect(ctx.db.agentMemory.create).not.toHaveBeenCalled();
  });

  it('falls through to create when supersedes ID not found in existing', async () => {
    const existing = [{ id: 'mem-1', content: 'Some fact' }];
    const ctx = makeCtx(existing, '{"action": "update", "insight": "New insight", "supersedes": "mem-nonexistent"}');
    await synthesizeUserInsight(ctx as never, 'agent-1', 'Aria', 'new fact');
    expect(ctx.db.agentMemory.update).not.toHaveBeenCalled();
    expect(ctx.db.agentMemory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: 'New insight',
        type: 'SEMANTIC',
      }),
    });
  });

  it('gracefully handles Haiku synthesis failure', async () => {
    const existing = [{ id: 'mem-1', content: 'Some fact' }];
    const ctx = makeCtx(existing);
    ctx.invoker.invoke.mockRejectedValue(new Error('Network error'));
    await synthesizeUserInsight(ctx as never, 'agent-1', 'Aria', 'new fact');
    expect(ctx.db.agentMemory.create).not.toHaveBeenCalled();
    expect(ctx.logger.warn).toHaveBeenCalledWith('identity: user insight synthesis failed', expect.objectContaining({ agentId: 'agent-1' }));
  });

  it('always writes scope AGENT regardless of context', async () => {
    const ctx = makeCtx([]);
    await synthesizeUserInsight(ctx as never, 'agent-1', 'Aria', 'lives in Phoenix');
    expect(ctx.db.agentMemory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ scope: 'AGENT' }),
    });
  });

  it('always writes importance 8', async () => {
    const ctx = makeCtx([]);
    await synthesizeUserInsight(ctx as never, 'agent-1', 'Aria', 'likes spicy food');
    expect(ctx.db.agentMemory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ importance: 8 }),
    });
  });

  it('limits SEMANTIC memory query to 50 records', async () => {
    const existing = [{ id: 'mem-1', content: 'Some fact' }];
    const ctx = makeCtx(existing, '{"action": "skip"}');
    await synthesizeUserInsight(ctx as never, 'agent-1', 'Aria', 'new fact');
    expect(ctx.db.agentMemory.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });
});
