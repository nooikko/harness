import { describe, expect, it, vi } from 'vitest';
import { scoreAndWriteMemory } from '../score-and-write-memory';

const makeCtx = (importanceOutput: string, summaryOutput: string) => ({
  invoker: {
    invoke: vi.fn().mockResolvedValueOnce({ output: importanceOutput }).mockResolvedValueOnce({ output: summaryOutput }),
  },
  db: {
    agentMemory: {
      create: vi.fn().mockResolvedValue({}),
      // Reflection trigger queries — default to not triggering (< 10 memories)
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
});

describe('scoreAndWriteMemory', () => {
  it('does nothing when output is empty string', async () => {
    const ctx = makeCtx('{"importance": 8}', '{"summary": "Summary of response."}');
    await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', '');
    expect(ctx.invoker.invoke).not.toHaveBeenCalled();
    expect(ctx.db.agentMemory.create).not.toHaveBeenCalled();
  });

  it('does nothing when output is only whitespace', async () => {
    const ctx = makeCtx('8', 'Summary.');
    await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', '   \n  ');
    expect(ctx.invoker.invoke).not.toHaveBeenCalled();
    expect(ctx.db.agentMemory.create).not.toHaveBeenCalled();
  });

  it('does NOT write memory when importance is below threshold (< 6)', async () => {
    const ctx = makeCtx('{"importance": 4}', '{"summary": "Summary."}');
    await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Some output content.');
    expect(ctx.db.agentMemory.create).not.toHaveBeenCalled();
  });

  it('does NOT write memory when importance is exactly 5', async () => {
    const ctx = makeCtx('{"importance": 5}', '{"summary": "Summary."}');
    await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Some output content.');
    expect(ctx.db.agentMemory.create).not.toHaveBeenCalled();
  });

  it('writes memory when importance is exactly 6 (at threshold)', async () => {
    const ctx = makeCtx('{"importance": 6}', '{"summary": "The agent provided a key insight.", "scope": "AGENT"}');
    await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Some output content.');
    expect(ctx.db.agentMemory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentId: 'agent-1',
        content: 'The agent provided a key insight.',
        type: 'EPISODIC',
        importance: 6,
        threadId: 'thread-1',
      }),
    });
  });

  it('writes memory when importance is above threshold (> 6)', async () => {
    const ctx = makeCtx('{"importance": 9}', '{"summary": "Critical decision was made.", "scope": "AGENT"}');
    await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Output about a major decision.');
    expect(ctx.db.agentMemory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentId: 'agent-1',
        content: 'Critical decision was made.',
        type: 'EPISODIC',
        importance: 9,
        threadId: 'thread-1',
      }),
    });
  });

  it('logs debug message after writing memory', async () => {
    const ctx = makeCtx('{"importance": 8}', '{"summary": "Summary content.", "scope": "AGENT"}');
    await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Meaningful output.');
    expect(ctx.logger.debug).toHaveBeenCalledWith(
      'Wrote episodic memory',
      expect.objectContaining({
        agentId: 'agent-1',
        threadId: 'thread-1',
        importance: 8,
      }),
    );
  });

  it('silently returns when importance scoring throws', async () => {
    const ctx = {
      invoker: {
        invoke: vi.fn().mockRejectedValue(new Error('Network error')),
      },
      db: { agentMemory: { create: vi.fn() } },
      logger: { debug: vi.fn(), warn: vi.fn() },
    };
    await expect(scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Some output.')).resolves.toBeUndefined();
    expect(ctx.db.agentMemory.create).not.toHaveBeenCalled();
  });

  it('does not write memory when importance score is NaN', async () => {
    const ctx = makeCtx('not-a-number', 'Summary.');
    await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Some output.');
    expect(ctx.db.agentMemory.create).not.toHaveBeenCalled();
  });

  it('falls back to snippet when summary invocation throws', async () => {
    const ctx = {
      invoker: {
        invoke: vi.fn().mockResolvedValueOnce({ output: '{"importance": 7}' }).mockRejectedValueOnce(new Error('Summary failed')),
      },
      db: {
        agentMemory: { create: vi.fn().mockResolvedValue({}), findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      },
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
    };
    await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Output content that is meaningful.');
    expect(ctx.db.agentMemory.create).toHaveBeenCalled();
    const callData = ctx.db.agentMemory.create.mock.calls[0]![0].data;
    expect(callData.content).toBe('Output content that is meaningful.');
  });

  it('includes tail of long output in the scoring snippet so conclusions are not missed', async () => {
    // 600-char output: 250 head chars + [...] + 250 tail chars should appear in scoring prompt
    const head = 'A'.repeat(250);
    const middle = 'B'.repeat(100);
    const tail = 'C'.repeat(250);
    const longOutput = head + middle + tail;

    const ctx = makeCtx('{"importance": 8}', '{"summary": "Summary of long response."}');
    await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', longOutput);

    const scoringPrompt = (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(scoringPrompt).toContain('A'.repeat(250)); // head present
    expect(scoringPrompt).toContain('C'.repeat(250)); // tail present
    expect(scoringPrompt).toContain('[...]'); // ellipsis separator
    expect(scoringPrompt).not.toContain('B'.repeat(100)); // middle omitted
  });

  it('uses full output in scoring snippet when output fits within head+tail limit', async () => {
    const shortOutput = 'Short output.';
    const ctx = makeCtx('{"importance": 7}', '{"summary": "Summary."}');
    await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', shortOutput);

    const scoringPrompt = (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(scoringPrompt).toContain(shortOutput);
    expect(scoringPrompt).not.toContain('[...]');
  });

  describe('userFact detection and synthesis trigger', () => {
    it('triggers synthesis when importance response includes userFact', async () => {
      const ctx = makeCtx('{"importance": 8, "userFact": "has ADD"}', '{"summary": "Summary.", "scope": "AGENT"}');
      // Add findMany for synthesizeUserInsight (no existing SEMANTIC memories)
      ctx.db.agentMemory.findMany.mockResolvedValue([]);
      await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Meaningful output.');
      // Allow fire-and-forget to settle
      await new Promise<void>((resolve) => setImmediate(resolve));
      // Should have called findMany for SEMANTIC memories (synthesis check)
      expect(ctx.db.agentMemory.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { agentId: 'agent-1', type: 'SEMANTIC' } }));
    });

    it('does not trigger synthesis when no userFact in response', async () => {
      const ctx = makeCtx('{"importance": 8}', '{"summary": "Summary.", "scope": "AGENT"}');
      await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Meaningful output.');
      await new Promise<void>((resolve) => setImmediate(resolve));
      // findMany should NOT have been called for SEMANTIC type
      const findManyCalls = ctx.db.agentMemory.findMany.mock.calls;
      const semanticCall = findManyCalls.find((call: unknown[]) => (call[0] as { where: { type?: string } })?.where?.type === 'SEMANTIC');
      expect(semanticCall).toBeUndefined();
    });

    it('triggers synthesis even when importance is below episodic threshold', async () => {
      const ctx = makeCtx('{"importance": 3, "userFact": "has ADD"}', '{"summary": "Summary.", "scope": "AGENT"}');
      ctx.db.agentMemory.findMany.mockResolvedValue([]);
      await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Casual chat mentioning ADD.');
      // Allow fire-and-forget synthesis to settle
      await new Promise<void>((resolve) => setImmediate(resolve));
      // Episodic memory should NOT be written (below threshold) but SEMANTIC should be
      const createCalls = ctx.db.agentMemory.create.mock.calls;
      const episodicCall = createCalls.find((call: unknown[]) => (call[0] as { data: { type: string } }).data.type === 'EPISODIC');
      const semanticCall = createCalls.find((call: unknown[]) => (call[0] as { data: { type: string } }).data.type === 'SEMANTIC');
      expect(episodicCall).toBeUndefined();
      expect(semanticCall).toBeDefined();
      expect((semanticCall![0] as { data: { content: string } }).data.content).toBe('has ADD');
    });
  });

  describe('reflectionEnabled parameter', () => {
    const makeReflectionCtx = (importanceOutput: string, summaryOutput: string, unreflectedCount: number) => {
      const unreflectedMemories = Array.from({ length: unreflectedCount }, (_, i) => ({
        id: `mem-${i}`,
        content: `Memory ${i}`,
        importance: 7,
        createdAt: new Date(),
      }));

      return {
        invoker: {
          invoke: vi.fn().mockResolvedValueOnce({ output: importanceOutput }).mockResolvedValueOnce({ output: summaryOutput }),
        },
        db: {
          agentMemory: {
            create: vi.fn().mockResolvedValue({}),
            findFirst: vi.fn().mockResolvedValue(null), // no prior reflection
            findMany: vi.fn().mockResolvedValue(unreflectedMemories),
          },
        },
        logger: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      };
    };

    it('does not call checkReflectionTrigger when reflectionEnabled is false', async () => {
      const ctx = makeReflectionCtx('{"importance": 8}', '{"summary": "Important event.", "scope": "AGENT"}', 15);
      await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Meaningful output.', { reflectionEnabled: false });

      // Memory should still be written
      expect(ctx.db.agentMemory.create).toHaveBeenCalled();
      // But reflection trigger queries should NOT have been called
      // findFirst is used by checkReflectionTrigger to find the last REFLECTION memory
      expect(ctx.db.agentMemory.findFirst).not.toHaveBeenCalled();
    });

    it('calls checkReflectionTrigger when reflectionEnabled is true', async () => {
      const ctx = makeReflectionCtx('{"importance": 8}', '{"summary": "Important event.", "scope": "AGENT"}', 15);
      await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Meaningful output.', { reflectionEnabled: true });

      // Memory should be written
      expect(ctx.db.agentMemory.create).toHaveBeenCalled();
      // Reflection trigger should have been checked (findFirst is called by checkReflectionTrigger)
      // Allow fire-and-forget to settle
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(ctx.db.agentMemory.findFirst).toHaveBeenCalled();
    });

    it('does not call checkReflectionTrigger when reflectionEnabled is omitted (defaults to false)', async () => {
      const ctx = makeReflectionCtx('{"importance": 8}', '{"summary": "Important event.", "scope": "AGENT"}', 15);
      await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Meaningful output.');

      expect(ctx.db.agentMemory.create).toHaveBeenCalled();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(ctx.db.agentMemory.findFirst).not.toHaveBeenCalled();
    });

    it('logs warning when reflection trigger throws', async () => {
      const ctx = makeReflectionCtx('{"importance": 8}', '{"summary": "Important event.", "scope": "AGENT"}', 15);
      ctx.db.agentMemory.findFirst.mockRejectedValue(new Error('DB failure'));
      await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Meaningful output.', { reflectionEnabled: true });

      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('reflection trigger failed'));
    });
  });

  describe('synthesizeUserInsight error handling', () => {
    it('logs warning when synthesis fails', async () => {
      const ctx = makeCtx('{"importance": 3, "userFact": "has ADD"}', '');
      // Make findMany throw to simulate synthesis failure
      ctx.db.agentMemory.findMany.mockRejectedValue(new Error('DB error'));
      await scoreAndWriteMemory(ctx as never, 'agent-1', 'Aria', 'thread-1', 'Chat.');
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('user insight synthesis failed'), expect.any(Object));
    });
  });
});
