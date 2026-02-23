import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { PluginContext } from '@harness/plugin-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contextPlugin, createContextPlugin } from '../index';

let TEST_DIR: string;
let CONTEXT_DIR: string;

type MockFindMany = ReturnType<typeof vi.fn>;

type CreateMockContextOptions = {
  findMany?: MockFindMany;
};

type CreateMockContext = (options?: CreateMockContextOptions) => PluginContext;

const createMockContext: CreateMockContext = (options) => ({
  db: {
    message: {
      findMany: options?.findMany ?? vi.fn().mockResolvedValue([]),
    },
  } as never,
  invoker: { invoke: vi.fn() },
  config: {} as never,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  sendToThread: vi.fn(),
  broadcast: vi.fn(),
});

beforeEach(() => {
  TEST_DIR = mkdtempSync(resolve(tmpdir(), 'harness-ctx-idx-'));
  CONTEXT_DIR = resolve(TEST_DIR, 'context');
  mkdirSync(CONTEXT_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('context plugin', () => {
  it('has correct name and version', () => {
    const plugin = createContextPlugin();

    expect(plugin.name).toBe('context');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers and returns onBeforeInvoke hook', async () => {
    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext();

    const hooks = await plugin.register(ctx);

    expect(hooks.onBeforeInvoke).toBeDefined();
    expect(typeof hooks.onBeforeInvoke).toBe('function');
  });

  it('injects context files into the prompt', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'memory.md'), 'I remember things');
    writeFileSync(resolve(CONTEXT_DIR, 'inbox.md'), 'New items today');

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'User message');

    expect(result).toContain('I remember things');
    expect(result).toContain('New items today');
    expect(result).toContain('User message');
    expect(result).toContain('# Context');
  });

  it('injects conversation history into the prompt', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        role: 'assistant',
        content: 'Previous reply',
        createdAt: new Date('2026-02-23T12:01:00Z'),
      },
      {
        role: 'user',
        content: 'Previous question',
        createdAt: new Date('2026-02-23T12:00:00Z'),
      },
    ]);

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ findMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'New question');

    expect(result).toContain('# Conversation History');
    expect(result).toContain('[user]: Previous question');
    expect(result).toContain('[assistant]: Previous reply');
    expect(result).toContain('New question');
  });

  it('combines context files, history, and prompt', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'memory.md'), 'Memory data');

    const findMany = vi.fn().mockResolvedValue([
      {
        role: 'user',
        content: 'Earlier message',
        createdAt: new Date('2026-02-23T11:00:00Z'),
      },
    ]);

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ findMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'Current prompt');

    expect(result).toBeDefined();

    // All three sections present
    expect(result).toContain('# Context');
    expect(result).toContain('Memory data');
    expect(result).toContain('# Conversation History');
    expect(result).toContain('[user]: Earlier message');
    expect(result).toContain('Current prompt');

    // Context section comes before history
    const text = result ?? '';
    const contextIdx = text.indexOf('# Context');
    const historyIdx = text.indexOf('# Conversation History');
    const promptIdx = text.indexOf('Current prompt');
    expect(contextIdx).toBeLessThan(historyIdx);
    expect(historyIdx).toBeLessThan(promptIdx);
  });

  it('handles all context files missing gracefully', async () => {
    // Empty context dir - no files
    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'Just a prompt');

    expect(result).toBe('Just a prompt');
  });

  it('handles empty conversation history', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'memory.md'), 'Memory only');

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'My prompt');

    expect(result).toContain('# Context');
    expect(result).toContain('Memory only');
    expect(result).not.toContain('# Conversation History');
    expect(result).toContain('My prompt');
  });

  it('respects custom history limit', async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const plugin = createContextPlugin({
      contextDir: CONTEXT_DIR,
      historyLimit: 10,
    });
    const ctx = createMockContext({ findMany });
    const hooks = await plugin.register(ctx);

    await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });

  it('logs registration with context directory', async () => {
    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext();

    await plugin.register(ctx);

    expect(ctx.logger.info).toHaveBeenCalledWith('Context plugin registered', {
      contextDir: CONTEXT_DIR,
    });
  });

  it('logs debug when context files are missing', async () => {
    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(ctx.logger.debug).toHaveBeenCalledWith(
      'Some context files not found',
      expect.objectContaining({
        missing: expect.arrayContaining(['memory.md']),
      }),
    );
  });

  it('passes correct threadId to database query', async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ findMany });
    const hooks = await plugin.register(ctx);

    await hooks.onBeforeInvoke?.('specific-thread-id', 'prompt');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { threadId: 'specific-thread-id' },
      }),
    );
  });

  it('does not log debug when all context files are present', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'memory.md'), 'Memory');
    writeFileSync(resolve(CONTEXT_DIR, 'world-state.md'), 'World');
    writeFileSync(resolve(CONTEXT_DIR, 'thread-summaries.md'), 'Summaries');
    writeFileSync(resolve(CONTEXT_DIR, 'inbox.md'), 'Inbox');

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(ctx.logger.debug).not.toHaveBeenCalled();
  });

  it('uses default contextDir when no options provided', async () => {
    const plugin = createContextPlugin();
    const ctx = createMockContext();

    const hooks = await plugin.register(ctx);

    // The hook should still work, just reading from the default cwd/context
    const result = await hooks.onBeforeInvoke?.('thread-1', 'test prompt');

    // It should at least return the prompt (context files won't exist at cwd/context)
    expect(result).toContain('test prompt');
  });

  it('exports contextPlugin definition with correct structure', async () => {
    expect(contextPlugin.name).toBe('context');
    expect(contextPlugin.version).toBe('1.0.0');
    expect(typeof contextPlugin.register).toBe('function');
  });

  it('separates sections with dividers', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'memory.md'), 'Memory');

    const findMany = vi.fn().mockResolvedValue([
      {
        role: 'user',
        content: 'Msg',
        createdAt: new Date(),
      },
    ]);

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ findMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('t1', 'Current');

    expect(result).toBeDefined();

    // Sections are separated by "---" dividers
    const text = result ?? '';
    const dividerCount = (text.match(/\n\n---\n\n/g) ?? []).length;
    expect(dividerCount).toBeGreaterThanOrEqual(2);
  });
});
