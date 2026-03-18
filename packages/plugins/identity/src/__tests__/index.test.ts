import type { AgentMemory } from '@harness/database';
import type { InvokeResult, PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

type MockAgent = {
  id: string;
  name: string;
  soul: string;
  identity: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type MockAgentConfig = {
  id: string;
  agentId: string;
  memoryEnabled: boolean;
  reflectionEnabled: boolean;
  bootstrapped: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CreateMockContextOptions = {
  threadAgentId?: string | null;
  agent?: MockAgent | null;
  memories?: AgentMemory[];
  invokerOutput?: string;
  agentConfig?: MockAgentConfig | null;
};

type CreateMockContext = (options?: CreateMockContextOptions) => PluginContext;

const createMockContext: CreateMockContext = (options) => {
  const agentId = options?.threadAgentId !== undefined ? options.threadAgentId : 'agent-1';
  const agent =
    options?.agent !== undefined
      ? options.agent
      : agentId
        ? {
            id: agentId,
            name: 'Aria',
            soul: '# Core Truths\n\nI value honesty above all else.\n\n# Vibe\n\nWarm and direct.',
            identity: 'I am Aria, a helpful assistant.',
            enabled: true,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
            threadProjectId: null,
          }
        : null;

  const memories: AgentMemory[] = options?.memories ?? [];
  const invokerOutput = options?.invokerOutput ?? '8';
  const agentConfig = options?.agentConfig !== undefined ? options.agentConfig : null;

  return {
    db: {
      thread: {
        findUnique: vi.fn().mockResolvedValue(agentId ? { agentId, projectId: null } : { agentId: null, projectId: null }),
      },
      agent: {
        findFirst: vi.fn().mockResolvedValue(agent),
      },
      agentMemory: {
        findFirst: vi.fn().mockResolvedValue(null), // reflection trigger: no prior reflection
        findMany: vi.fn().mockResolvedValue(memories),
        updateMany: vi.fn().mockResolvedValue({ count: memories.length }),
        create: vi.fn().mockResolvedValue({}),
      },
      agentConfig: {
        findUnique: vi.fn().mockResolvedValue(agentConfig),
      },
    } as never,
    invoker: {
      invoke: vi.fn().mockResolvedValue({ output: invokerOutput } as InvokeResult),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    config: {} as never,
    sendToThread: vi.fn(),
    broadcast: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({}),
    notifySettingsChange: vi.fn().mockResolvedValue(undefined),
    reportStatus: vi.fn(),
  };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('identity plugin', () => {
  describe('plugin metadata', () => {
    it('has name identity and version 1.0.0', () => {
      expect(plugin.name).toBe('identity');
      expect(plugin.version).toBe('1.0.0');
    });

    it('register returns hooks object with onBeforeInvoke and onAfterInvoke', async () => {
      const ctx = createMockContext();
      const hooks = await plugin.register(ctx);

      expect(hooks.onBeforeInvoke).toBeDefined();
      expect(typeof hooks.onBeforeInvoke).toBe('function');
      expect(hooks.onAfterInvoke).toBeDefined();
      expect(typeof hooks.onAfterInvoke).toBe('function');
    });
  });

  describe('onBeforeInvoke', () => {
    it('returns the original prompt unchanged when thread has no agentId', async () => {
      const ctx = createMockContext({ threadAgentId: null });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-1', 'Hello world');

      expect(result).toBe('Hello world');
    });

    it('returns original prompt unchanged when agent is not found (disabled or missing)', async () => {
      const ctx = createMockContext({ agent: null });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-1', 'Hello world');

      expect(result).toBe('Hello world');
    });

    it('wraps prompt with soul header and anchor when agent exists and has no memories', async () => {
      const ctx = createMockContext({ memories: [] });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-1', 'What should I do today?');

      expect(result).toBeDefined();
      expect(result).not.toBe('What should I do today?');
      // Should have at least two --- separators (header---prompt---anchor)
      const dividerCount = (result?.match(/\n\n---\n\n/g) ?? []).length;
      expect(dividerCount).toBeGreaterThanOrEqual(2);
    });

    it('includes memories section in header when agent has memories', async () => {
      const memories: AgentMemory[] = [
        {
          id: 'mem-1',
          agentId: 'agent-1',
          content: 'Aria helped the user deploy their first microservice.',
          type: 'EPISODIC',
          scope: 'AGENT',
          importance: 8,
          threadId: 'thread-old',
          projectId: null,
          sourceMemoryIds: [],
          createdAt: new Date('2026-01-15T10:00:00Z'),
          lastAccessedAt: new Date('2026-01-15T10:00:00Z'),
        },
      ];

      const ctx = createMockContext({ memories });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-1', 'Let us continue');

      expect(result).toContain('Relevant Memory');
      expect(result).toContain('Aria helped the user deploy their first microservice.');
    });

    it('includes the soul content in the injected output', async () => {
      const ctx = createMockContext({ memories: [] });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-1', 'Hi');

      expect(result).toContain('I value honesty above all else.');
    });

    it('includes the agent name in the anchor', async () => {
      const ctx = createMockContext({ memories: [] });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-1', 'Hi');

      expect(result).toContain('Aria — Behavioral Anchor');
      expect(result).toContain('You are Aria.');
    });

    it('includes the Chain of Persona instruction in the output', async () => {
      const ctx = createMockContext({ memories: [] });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-1', 'Hi');

      // The Chain of Persona instruction prompts the agent to reflect before responding
      expect(result).toContain('Before responding, briefly consider');
    });

    it('preserves the original prompt content in the output', async () => {
      const prompt = 'Please help me refactor this function.';
      const ctx = createMockContext({ memories: [] });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-1', prompt);

      expect(result).toContain(prompt);
    });

    it('uses --- separators between header, prompt, and anchor', async () => {
      const ctx = createMockContext({ memories: [] });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-1', 'My prompt');

      expect(result).toBeDefined();
      const text = result ?? '';

      // header before prompt, prompt before anchor
      const headerIdx = text.indexOf('Session Identity');
      const promptIdx = text.indexOf('My prompt');
      const anchorIdx = text.indexOf('Behavioral Anchor');

      expect(headerIdx).toBeLessThan(promptIdx);
      expect(promptIdx).toBeLessThan(anchorIdx);

      // Dividers separate the three sections
      const dividerCount = (text.match(/\n\n---\n\n/g) ?? []).length;
      expect(dividerCount).toBe(2);
    });
  });

  describe('onAfterInvoke', () => {
    // Helper: flush all pending microtasks/promises
    const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

    it('does nothing when thread has no agent', async () => {
      const ctx = createMockContext({ threadAgentId: null });
      const hooks = await plugin.register(ctx);
      const mockInvoker = ctx.invoker.invoke as ReturnType<typeof vi.fn>;
      const mockCreate = (ctx.db as never as { agentMemory: { create: ReturnType<typeof vi.fn> } }).agentMemory.create;

      await hooks.onAfterInvoke?.('thread-1', { output: 'Some response' } as InvokeResult);

      expect(mockInvoker).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('resolves immediately without waiting for the background memory write (fire-and-forget)', async () => {
      let resolveInvoker!: (value: InvokeResult) => void;
      const slowInvokerPromise = new Promise<InvokeResult>((resolve) => {
        resolveInvoker = resolve;
      });

      const ctx = createMockContext();
      // Override invoker to never resolve until we explicitly do so
      (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mockReturnValue(slowInvokerPromise);

      const hooks = await plugin.register(ctx);
      const mockCreate = (ctx.db as never as { agentMemory: { create: ReturnType<typeof vi.fn> } }).agentMemory.create;

      // The hook itself should resolve before the slow invoker does
      await hooks.onAfterInvoke?.('thread-1', { output: 'Response content' } as InvokeResult);

      // Hook has returned, but background task is still waiting on slowInvokerPromise
      expect(mockCreate).not.toHaveBeenCalled();

      // Unblock the invoker so background work can complete (avoid dangling promises in test)
      resolveInvoker({ output: '3' } as InvokeResult); // importance < 6, no write
      await flushPromises();
      await flushPromises();
    });

    it('calls invoker.invoke for importance scoring in the background', async () => {
      const ctx = createMockContext({ invokerOutput: '8' });
      const hooks = await plugin.register(ctx);

      await hooks.onAfterInvoke?.('thread-1', { output: 'Significant insight about architecture' } as InvokeResult);

      // Let the fire-and-forget task complete
      await flushPromises();
      await flushPromises();

      expect(ctx.invoker.invoke).toHaveBeenCalledWith(
        expect.stringContaining('Rate the importance'),
        expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
      );
    });

    it('writes AgentMemory when importance is >= 6', async () => {
      // First invoke returns importance score 7, second returns summary
      const mockInvoke = vi
        .fn()
        .mockResolvedValueOnce({ output: '{"importance": 7}' } as InvokeResult)
        .mockResolvedValueOnce({ output: '{"summary": "Aria discussed architecture patterns with the user."}' } as InvokeResult);

      const ctx = createMockContext();
      (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mockImplementation(mockInvoke);

      const hooks = await plugin.register(ctx);

      await hooks.onAfterInvoke?.('thread-1', { output: 'We should use event sourcing.' } as InvokeResult);

      // Let background task run to completion
      await flushPromises();
      await flushPromises();

      const mockCreate = (ctx.db as never as { agentMemory: { create: ReturnType<typeof vi.fn> } }).agentMemory.create;
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            agentId: 'agent-1',
            type: 'EPISODIC',
            importance: 7,
            threadId: 'thread-1',
          }),
        }),
      );
    });

    it('does not write AgentMemory when importance is below 6', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({ output: '3' } as InvokeResult);

      const ctx = createMockContext();
      (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mockImplementation(mockInvoke);

      const hooks = await plugin.register(ctx);

      await hooks.onAfterInvoke?.('thread-1', { output: 'Hello, how are you?' } as InvokeResult);

      await flushPromises();
      await flushPromises();

      const mockCreate = (ctx.db as never as { agentMemory: { create: ReturnType<typeof vi.fn> } }).agentMemory.create;
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('does not call scoreAndWriteMemory when AgentConfig.memoryEnabled is false', async () => {
      const config: MockAgentConfig = {
        id: 'cfg-1',
        agentId: 'agent-1',
        memoryEnabled: false,
        reflectionEnabled: false,
        bootstrapped: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };

      const ctx = createMockContext({ agentConfig: config });
      const hooks = await plugin.register(ctx);
      const mockInvoker = ctx.invoker.invoke as ReturnType<typeof vi.fn>;

      await hooks.onAfterInvoke?.('thread-1', { output: 'Significant insight' } as InvokeResult);

      await flushPromises();
      await flushPromises();

      // invoker should NOT have been called for importance scoring
      expect(mockInvoker).not.toHaveBeenCalled();
      const mockCreate = (ctx.db as never as { agentMemory: { create: ReturnType<typeof vi.fn> } }).agentMemory.create;
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('bootstrap prompt injection', () => {
    it('includes bootstrap text when config.bootstrapped is false', async () => {
      const config: MockAgentConfig = {
        id: 'cfg-1',
        agentId: 'agent-1',
        memoryEnabled: true,
        reflectionEnabled: false,
        bootstrapped: false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };

      const ctx = createMockContext({ agentConfig: config });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-1', 'Hello');

      expect(result).toContain('Bootstrap');
      expect(result).toContain('First-Time Setup');
    });

    it('does not include bootstrap text when config.bootstrapped is true', async () => {
      const config: MockAgentConfig = {
        id: 'cfg-1',
        agentId: 'agent-1',
        memoryEnabled: true,
        reflectionEnabled: false,
        bootstrapped: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      };

      const ctx = createMockContext({ agentConfig: config });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-1', 'Hello');

      expect(result).not.toContain('Bootstrap');
      expect(result).not.toContain('First-Time Setup');
    });

    it('does not include bootstrap text when config is null', async () => {
      const ctx = createMockContext({ agentConfig: null });
      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-1', 'Hello');

      expect(result).not.toContain('Bootstrap');
      expect(result).not.toContain('First-Time Setup');
    });
  });

  describe('tools', () => {
    it('exposes an update_self tool', () => {
      expect(plugin.tools).toHaveLength(1);
      expect(plugin.tools?.[0]?.name).toBe('update_self');
    });
  });
});
