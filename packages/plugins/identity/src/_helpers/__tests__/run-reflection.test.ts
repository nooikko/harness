import { describe, expect, it, vi } from 'vitest';
import { runReflection } from '../run-reflection';

const makeMemory = (id: string, importance = 7) => ({
  id,
  content: `Experience from memory ${id}`,
  importance,
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

const makeCtx = (invokeOutput: string) => ({
  invoker: {
    invoke: vi.fn().mockResolvedValue({ output: invokeOutput }),
  },
  db: {
    agentMemory: {
      createMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
});

describe('runReflection', () => {
  it('calls Haiku with the agent name and all memories', async () => {
    const ctx = makeCtx('{"insights": ["Insight one", "Insight two", "Insight three"]}');
    const memories = [makeMemory('m-1'), makeMemory('m-2')];

    await runReflection(ctx as never, 'agent-1', 'Aria', memories);

    const prompt = (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(prompt).toContain('Aria');
    expect(prompt).toContain('Experience from memory m-1');
    expect(prompt).toContain('Experience from memory m-2');
  });

  it('writes each parsed insight as a REFLECTION memory', async () => {
    const ctx = makeCtx('{"insights": ["Aria is good at debugging", "Users prefer concise answers", "Aria should ask clarifying questions"]}');
    const memories = [makeMemory('m-1'), makeMemory('m-2')];

    await runReflection(ctx as never, 'agent-1', 'Aria', memories);

    expect(ctx.db.agentMemory.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ content: 'Aria is good at debugging', type: 'REFLECTION', importance: 8 }),
        expect.objectContaining({ content: 'Users prefer concise answers', type: 'REFLECTION', importance: 8 }),
        expect.objectContaining({ content: 'Aria should ask clarifying questions', type: 'REFLECTION', importance: 8 }),
      ],
    });
  });

  it('sets sourceMemoryIds on every reflection to the input memory IDs', async () => {
    const ctx = makeCtx('{"insights": ["Insight one", "Insight two"]}');
    const memories = [makeMemory('m-1'), makeMemory('m-2'), makeMemory('m-3')];

    await runReflection(ctx as never, 'agent-1', 'Aria', memories);

    const { data } = (ctx.db.agentMemory.createMany as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { data: Array<{ sourceMemoryIds: string[] }> };
    for (const row of data) {
      expect(row.sourceMemoryIds).toEqual(['m-1', 'm-2', 'm-3']);
    }
  });

  it('sets agentId on every reflection', async () => {
    const ctx = makeCtx('{"insights": ["Only one insight"]}');
    await runReflection(ctx as never, 'agent-99', 'Aria', [makeMemory('m-1')]);

    const { data } = (ctx.db.agentMemory.createMany as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { data: Array<{ agentId: string }> };
    expect(data[0]!.agentId).toBe('agent-99');
  });

  it('does not call createMany when Haiku returns invalid JSON', async () => {
    const ctx = makeCtx('Here are some thoughts without JSON formatting.');
    await runReflection(ctx as never, 'agent-1', 'Aria', [makeMemory('m-1')]);

    expect(ctx.db.agentMemory.createMany).not.toHaveBeenCalled();
    expect(ctx.logger.warn).toHaveBeenCalledWith('Reflection synthesis failed', expect.objectContaining({ agentId: 'agent-1' }));
  });

  it('does not call createMany when Haiku returns an empty insights array', async () => {
    const ctx = makeCtx('{"insights": []}');
    await runReflection(ctx as never, 'agent-1', 'Aria', [makeMemory('m-1')]);

    expect(ctx.db.agentMemory.createMany).not.toHaveBeenCalled();
    expect(ctx.logger.warn).toHaveBeenCalledWith('Reflection synthesis failed', expect.objectContaining({ agentId: 'agent-1' }));
  });

  it('does not call createMany when Haiku invocation throws', async () => {
    const ctx = {
      invoker: { invoke: vi.fn().mockRejectedValue(new Error('Haiku error')) },
      db: { agentMemory: { createMany: vi.fn() } },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };
    await runReflection(ctx as never, 'agent-1', 'Aria', [makeMemory('m-1')]);

    expect(ctx.db.agentMemory.createMany).not.toHaveBeenCalled();
    expect(ctx.logger.warn).toHaveBeenCalledWith('Reflection synthesis failed', expect.objectContaining({ agentId: 'agent-1' }));
  });

  it('logs info after successfully writing reflections', async () => {
    const ctx = makeCtx('{"insights": ["Insight one", "Insight two"]}');
    const memories = [makeMemory('m-1'), makeMemory('m-2')];
    await runReflection(ctx as never, 'agent-1', 'Aria', memories);

    expect(ctx.logger.info).toHaveBeenCalledWith('Reflection complete', { agentId: 'agent-1', insights: 2, sourcedFrom: 2 });
  });

  it('extracts JSON from response wrapped in prose or code fences', async () => {
    const ctx = makeCtx('Here are the insights:\n```json\n{"insights": ["Key pattern identified"]}\n```\nThose are the key takeaways.');
    await runReflection(ctx as never, 'agent-1', 'Aria', [makeMemory('m-1')]);

    expect(ctx.db.agentMemory.createMany).toHaveBeenCalled();
    const { data } = (ctx.db.agentMemory.createMany as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { data: Array<{ content: string }> };
    expect(data[0]!.content).toBe('Key pattern identified');
  });
});
