import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { PluginContext } from '@harness/plugin-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContextPlugin, plugin } from '../index';

let TEST_DIR: string;
let CONTEXT_DIR: string;

type MockFindMany = ReturnType<typeof vi.fn>;
type MockFindUnique = ReturnType<typeof vi.fn>;

type CreateMockContextOptions = {
  findMany?: MockFindMany;
  summaryFindMany?: MockFindMany;
  threadFindUnique?: MockFindUnique;
};

type CreateMockContext = (options?: CreateMockContextOptions) => PluginContext;

// The context plugin calls db.message.findMany twice: first for summaries, then for history.
// summaryFindMany controls the summary call result; findMany controls the history call result.
const createMockContext: CreateMockContext = (options) => {
  const historyMock = options?.findMany ?? vi.fn().mockResolvedValue([]);
  const summaryMock = options?.summaryFindMany ?? vi.fn().mockResolvedValue([]);
  // Combine: dispatch based on the query kind to the appropriate mock
  const combinedFindMany = vi.fn().mockImplementation((query: { where?: { kind?: string } }) => {
    if (query?.where?.kind === 'summary') {
      return (summaryMock as (q: unknown) => unknown)(query);
    }
    return (historyMock as (q: unknown) => unknown)(query);
  });

  return {
    db: {
      message: {
        findMany: combinedFindMany,
      },
      thread: {
        findUnique: options?.threadFindUnique ?? vi.fn().mockResolvedValue({ sessionId: null, project: null }),
      },
      userProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
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
    getSettings: vi.fn().mockResolvedValue({}),
    notifySettingsChange: vi.fn().mockResolvedValue(undefined),
  };
};

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

  it('passes correct threadId to database query', async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ findMany });
    const hooks = await plugin.register(ctx);

    await hooks.onBeforeInvoke?.('specific-thread-id', 'prompt');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ threadId: 'specific-thread-id' }),
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

  it('exports plugin definition with correct structure', () => {
    expect(plugin.name).toBe('context');
    expect(plugin.version).toBe('1.0.0');
    expect(typeof plugin.register).toBe('function');
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

  it('discovers dynamically added context files', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'memory.md'), 'Memory');
    writeFileSync(resolve(CONTEXT_DIR, 'custom-notes.md'), 'Custom notes');

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(result).toContain('Memory');
    expect(result).toContain('Custom notes');
  });

  it('discovers context files in subdirectories', async () => {
    mkdirSync(resolve(CONTEXT_DIR, 'projects'), { recursive: true });
    writeFileSync(resolve(CONTEXT_DIR, 'projects', 'status.md'), 'Project status');

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(result).toContain('Project status');
  });

  it('respects custom file discovery config', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'notes.md'), 'Notes');
    writeFileSync(resolve(CONTEXT_DIR, 'data.txt'), 'Data');

    const plugin = createContextPlugin({
      contextDir: CONTEXT_DIR,
      fileDiscovery: { includePatterns: ['*.txt'] },
    });
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(result).toContain('Data');
    expect(result).not.toContain('Notes');
  });

  it('respects maxFileSize option', async () => {
    const largeContent = 'x'.repeat(500);
    writeFileSync(resolve(CONTEXT_DIR, 'large.md'), largeContent);

    const plugin = createContextPlugin({
      contextDir: CONTEXT_DIR,
      maxFileSize: 100,
    });
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(result).toContain('[... truncated at 100 bytes]');
  });

  it('logs debug when context files have read errors', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'readable.md'), 'Readable');
    writeFileSync(resolve(CONTEXT_DIR, 'unreadable.md'), 'Unreadable');
    // Remove read permission to trigger error path
    chmodSync(resolve(CONTEXT_DIR, 'unreadable.md'), 0o000);

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    // Restore permissions for cleanup
    chmodSync(resolve(CONTEXT_DIR, 'unreadable.md'), 0o644);

    expect(ctx.logger.debug).toHaveBeenCalledWith(
      'Some context files not found',
      expect.objectContaining({
        missing: expect.arrayContaining(['unreadable.md']),
      }),
    );
  });

  it('respects priorityFiles option', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'alpha.md'), 'Alpha');
    writeFileSync(resolve(CONTEXT_DIR, 'beta.md'), 'Beta');

    const plugin = createContextPlugin({
      contextDir: CONTEXT_DIR,
      priorityFiles: ['beta.md'],
    });
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'prompt');
    const text = result ?? '';

    // Beta should appear before Alpha due to priority
    const betaIdx = text.indexOf('Beta');
    const alphaIdx = text.indexOf('Alpha');
    expect(betaIdx).toBeLessThan(alphaIdx);
  });

  it('skips history injection when thread has an active sessionId', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'memory.md'), 'Memory data');

    const findMany = vi.fn().mockResolvedValue([{ role: 'user', content: 'Old message', createdAt: new Date() }]);
    // Thread has an active session — history should be skipped
    const threadFindUnique = vi.fn().mockResolvedValue({ sessionId: 'sess-abc-123', project: null });

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ findMany, threadFindUnique });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'My prompt');

    // History must not appear
    expect(result).not.toContain('# Conversation History');
    expect(result).not.toContain('Old message');
    // Context files and original prompt still appear
    expect(result).toContain('Memory data');
    expect(result).toContain('My prompt');
    // The skip was logged
    expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('Skipping history injection for resumed session'));
    // findMany should never have been called
    expect(findMany).not.toHaveBeenCalled();
  });

  it('continues without history when DB throws during thread lookup', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'memory.md'), 'Memory data');

    const threadFindUnique = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const findMany = vi.fn();

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ findMany, threadFindUnique });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'My prompt');

    // Context files and prompt still present
    expect(result).toContain('Memory data');
    expect(result).toContain('My prompt');
    // History section absent because DB was unavailable
    expect(result).not.toContain('# Conversation History');
    // Warning was logged with the error message
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Connection refused'));
    // loadHistory was never called because dbAvailable = false
    expect(findMany).not.toHaveBeenCalled();
  });

  it('injects prior conversation summary section when summaries exist', async () => {
    const summaries = [
      {
        content: 'The user and assistant discussed deployment plans.',
        createdAt: new Date('2026-02-23T12:00:00Z'),
      },
    ];

    const summaryFindMany = vi.fn().mockResolvedValue(summaries);
    const findMany = vi.fn().mockResolvedValue([]);

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ findMany, summaryFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(result).toContain('# Prior Conversation Summary');
    expect(result).toContain('The user and assistant discussed deployment plans.');
  });

  it('uses reduced history limit (25) when summaries exist', async () => {
    const summaries = [
      {
        content: 'Prior summary.',
        createdAt: new Date('2026-02-23T12:00:00Z'),
      },
    ];

    const summaryFindMany = vi.fn().mockResolvedValue(summaries);
    const findMany = vi.fn().mockResolvedValue([]);

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ findMany, summaryFindMany });
    const hooks = await plugin.register(ctx);

    await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
  });

  it('falls back to 50-message history when no summaries exist', async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ findMany });
    const hooks = await plugin.register(ctx);

    await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });

  it('places summary section between context files and raw history', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'memory.md'), 'Context file content');

    const summaries = [
      {
        content: 'Summary of prior conversation.',
        createdAt: new Date('2026-02-23T12:00:00Z'),
      },
    ];
    const historyMessages = [{ role: 'user', content: 'Recent message', createdAt: new Date('2026-02-23T13:00:00Z') }];

    const summaryFindMany = vi.fn().mockResolvedValue(summaries);
    const findMany = vi.fn().mockResolvedValue(historyMessages);

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ findMany, summaryFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'Current prompt');

    expect(result).toBeDefined();
    const text = result ?? '';
    const contextIdx = text.indexOf('# Context');
    const summaryIdx = text.indexOf('# Prior Conversation Summary');
    const historyIdx = text.indexOf('# Conversation History');
    const promptIdx = text.indexOf('Current prompt');

    // Order: context → summary → history → prompt
    expect(contextIdx).toBeLessThan(summaryIdx);
    expect(summaryIdx).toBeLessThan(historyIdx);
    expect(historyIdx).toBeLessThan(promptIdx);
  });

  it('injects project instructions before global context when thread has a project', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'memory.md'), 'Global context data');

    const threadFindUnique = vi.fn().mockResolvedValue({
      sessionId: null,
      project: { instructions: 'Always respond in formal English.', memory: null },
    });

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ threadFindUnique });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'User message');

    expect(result).toBeDefined();
    const text = result ?? '';
    expect(text).toContain('<project_instructions>');
    expect(text).toContain('Always respond in formal English.');
    expect(text).toContain('</project_instructions>');

    // Project instructions must appear before global context files
    const instructionsIdx = text.indexOf('<project_instructions>');
    const contextIdx = text.indexOf('# Context');
    expect(instructionsIdx).toBeLessThan(contextIdx);
  });

  it('injects project memory after instructions but before global context', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'memory.md'), 'Global context data');

    const threadFindUnique = vi.fn().mockResolvedValue({
      sessionId: null,
      project: {
        instructions: 'Project instructions here.',
        memory: 'User prefers concise answers.',
      },
    });

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ threadFindUnique });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'User message');

    expect(result).toBeDefined();
    const text = result ?? '';
    expect(text).toContain('<project_memory>');
    expect(text).toContain('User prefers concise answers.');
    expect(text).toContain('</project_memory>');

    // Order: instructions → memory → global context
    const instructionsIdx = text.indexOf('<project_instructions>');
    const memoryIdx = text.indexOf('<project_memory>');
    const contextIdx = text.indexOf('# Context');
    expect(instructionsIdx).toBeLessThan(memoryIdx);
    expect(memoryIdx).toBeLessThan(contextIdx);
  });

  it('injects both project instructions and memory with correct ordering', async () => {
    const threadFindUnique = vi.fn().mockResolvedValue({
      sessionId: null,
      project: {
        instructions: 'You are a coding assistant.',
        memory: 'User is working on a TypeScript monorepo.',
      },
    });

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ threadFindUnique });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'Help me debug this');

    expect(result).toBeDefined();
    const text = result ?? '';

    expect(text).toContain('You are a coding assistant.');
    expect(text).toContain('User is working on a TypeScript monorepo.');
    expect(text).toContain('Help me debug this');

    // Order: instructions → memory → prompt
    const instructionsIdx = text.indexOf('<project_instructions>');
    const memoryIdx = text.indexOf('<project_memory>');
    const promptIdx = text.indexOf('Help me debug this');
    expect(instructionsIdx).toBeLessThan(memoryIdx);
    expect(memoryIdx).toBeLessThan(promptIdx);
  });

  it('output is unchanged when thread has no project', async () => {
    writeFileSync(resolve(CONTEXT_DIR, 'memory.md'), 'Context data');

    const findMany = vi.fn().mockResolvedValue([{ role: 'user', content: 'Hello', createdAt: new Date() }]);
    // Default mock: project: null
    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ findMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'Current message');

    expect(result).toBeDefined();
    const text = result ?? '';
    expect(text).not.toContain('<project_instructions>');
    expect(text).not.toContain('<project_memory>');
    expect(text).toContain('# Context');
    expect(text).toContain('Context data');
    expect(text).toContain('# Conversation History');
    expect(text).toContain('Current message');
  });

  it('omits project sections when instructions and memory are null', async () => {
    const threadFindUnique = vi.fn().mockResolvedValue({
      sessionId: null,
      project: { instructions: null, memory: null },
    });

    const plugin = createContextPlugin({ contextDir: CONTEXT_DIR });
    const ctx = createMockContext({ threadFindUnique });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'Just a prompt');

    expect(result).toBeDefined();
    const text = result ?? '';
    expect(text).not.toContain('<project_instructions>');
    expect(text).not.toContain('<project_memory>');
    expect(text).toContain('Just a prompt');
  });
});
