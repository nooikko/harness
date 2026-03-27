import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

type MockFindMany = ReturnType<typeof vi.fn>;
type MockFindUnique = ReturnType<typeof vi.fn>;
type MockFileFindMany = ReturnType<typeof vi.fn>;

type CreateMockContextOptions = {
  findMany?: MockFindMany;
  summaryFindMany?: MockFindMany;
  threadFindUnique?: MockFindUnique;
  fileFindMany?: MockFileFindMany;
};

const createMockContext = (options?: CreateMockContextOptions): PluginContext => {
  const historyMock = options?.findMany ?? vi.fn().mockResolvedValue([]);
  const summaryMock = options?.summaryFindMany ?? vi.fn().mockResolvedValue([]);
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
        findUnique: options?.threadFindUnique ?? vi.fn().mockResolvedValue({ sessionId: null, projectId: null, project: null }),
      },
      userProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      file: {
        findMany: options?.fileFindMany ?? vi.fn().mockResolvedValue([]),
      },
    } as never,
    invoker: { invoke: vi.fn() },
    config: { uploadDir: '/uploads' } as never,
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
    reportStatus: vi.fn(),
    reportBackgroundError: vi.fn(),
    runBackground: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
  };
};

describe('context plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('context');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers and returns onBeforeInvoke hook', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks.onBeforeInvoke).toBeDefined();
    expect(typeof hooks.onBeforeInvoke).toBe('function');
  });

  it('injects file references into the prompt', async () => {
    const fileFindMany = vi.fn().mockResolvedValue([
      {
        name: 'spec.md',
        mimeType: 'text/markdown',
        size: 2048,
        path: 'threads/t1/spec.md',
        scope: 'THREAD',
      },
    ]);

    const ctx = createMockContext({ fileFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'User message');

    expect(result).toContain('# Available Files');
    expect(result).toContain('spec.md');
    expect(result).toContain('User message');
  });

  it('injects file references even when sessionId exists', async () => {
    const threadFindUnique = vi.fn().mockResolvedValue({ sessionId: 'sess-123', projectId: null, project: null });
    const fileFindMany = vi.fn().mockResolvedValue([
      {
        name: 'data.json',
        mimeType: 'application/json',
        size: 1024,
        path: 'threads/t1/data.json',
        scope: 'THREAD',
      },
    ]);

    const ctx = createMockContext({ threadFindUnique, fileFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'My prompt');

    // File references appear even with an active session
    expect(result).toContain('# Available Files');
    expect(result).toContain('data.json');
    // History is skipped
    expect(result).not.toContain('# Conversation History');
  });

  it('produces no file section when no files exist', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'Just a prompt');

    expect(result).not.toContain('# Available Files');
    expect(result).toBe('Just a prompt');
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

    const ctx = createMockContext({ findMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'New question');

    expect(result).toContain('# Conversation History');
    expect(result).toContain('[user]: Previous question');
    expect(result).toContain('[assistant]: Previous reply');
    expect(result).toContain('New question');
  });

  it('combines file references, history, and prompt', async () => {
    const fileFindMany = vi.fn().mockResolvedValue([
      {
        name: 'notes.md',
        mimeType: 'text/markdown',
        size: 512,
        path: 'threads/t1/notes.md',
        scope: 'THREAD',
      },
    ]);
    const findMany = vi.fn().mockResolvedValue([
      {
        role: 'user',
        content: 'Earlier message',
        createdAt: new Date('2026-02-23T11:00:00Z'),
      },
    ]);

    const ctx = createMockContext({ findMany, fileFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'Current prompt');

    expect(result).toBeDefined();
    const text = result ?? '';
    expect(text).toContain('# Available Files');
    expect(text).toContain('# Conversation History');
    expect(text).toContain('Current prompt');

    // File references come before history
    const filesIdx = text.indexOf('# Available Files');
    const historyIdx = text.indexOf('# Conversation History');
    const promptIdx = text.indexOf('Current prompt');
    expect(filesIdx).toBeLessThan(historyIdx);
    expect(historyIdx).toBeLessThan(promptIdx);
  });

  it('handles empty conversation history', async () => {
    const fileFindMany = vi.fn().mockResolvedValue([
      {
        name: 'spec.md',
        mimeType: 'text/markdown',
        size: 256,
        path: 'threads/t1/spec.md',
        scope: 'THREAD',
      },
    ]);

    const ctx = createMockContext({ fileFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'My prompt');

    expect(result).toContain('# Available Files');
    expect(result).not.toContain('# Conversation History');
    expect(result).toContain('My prompt');
  });

  it('logs registration', async () => {
    const ctx = createMockContext();
    await plugin.register(ctx);

    expect(ctx.logger.info).toHaveBeenCalledWith('Context plugin registered');
  });

  it('passes correct threadId to database query', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const ctx = createMockContext({ findMany });
    const hooks = await plugin.register(ctx);

    await hooks.onBeforeInvoke?.('specific-thread-id', 'prompt');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ threadId: 'specific-thread-id' }),
      }),
    );
  });

  it('skips history injection when thread has an active sessionId', async () => {
    const findMany = vi.fn().mockResolvedValue([{ role: 'user', content: 'Old message', createdAt: new Date() }]);
    const threadFindUnique = vi.fn().mockResolvedValue({ sessionId: 'sess-abc-123', projectId: null, project: null });

    const ctx = createMockContext({ findMany, threadFindUnique });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'My prompt');

    expect(result).not.toContain('# Conversation History');
    expect(result).not.toContain('Old message');
    expect(result).toContain('My prompt');
    expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('Skipping history injection for resumed session'));
    expect(findMany).not.toHaveBeenCalled();
  });

  it('continues without history when DB throws during thread lookup', async () => {
    const threadFindUnique = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const findMany = vi.fn();

    const ctx = createMockContext({ findMany, threadFindUnique });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'My prompt');

    expect(result).toContain('My prompt');
    expect(result).not.toContain('# Conversation History');
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Connection refused'));
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

    const ctx = createMockContext({ findMany, summaryFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(result).toContain('# Prior Conversation Summary');
    expect(result).toContain('The user and assistant discussed deployment plans.');
  });

  it('filters out summaries with null or empty content', async () => {
    const summaries = [
      { content: null, createdAt: new Date('2026-02-23T11:00:00Z') },
      { content: '', createdAt: new Date('2026-02-23T11:30:00Z') },
      { content: 'Valid summary content.', createdAt: new Date('2026-02-23T12:00:00Z') },
    ];
    const summaryFindMany = vi.fn().mockResolvedValue(summaries);
    const findMany = vi.fn().mockResolvedValue([]);

    const ctx = createMockContext({ findMany, summaryFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(result).toContain('# Prior Conversation Summary');
    expect(result).toContain('Valid summary content.');
    expect(result).not.toContain('null');
  });

  it('falls back to full history limit when all summaries have null content', async () => {
    const summaries = [{ content: null, createdAt: new Date('2026-02-23T11:00:00Z') }];
    const summaryFindMany = vi.fn().mockResolvedValue(summaries);
    const findMany = vi.fn().mockResolvedValue([]);

    const ctx = createMockContext({ findMany, summaryFindMany });
    const hooks = await plugin.register(ctx);

    await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    // All summaries filtered out → uses default 50-message limit
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
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

    const ctx = createMockContext({ findMany, summaryFindMany });
    const hooks = await plugin.register(ctx);

    await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
  });

  it('falls back to 50-message history when no summaries exist', async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const ctx = createMockContext({ findMany });
    const hooks = await plugin.register(ctx);

    await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });

  it('places summary section between file references and raw history', async () => {
    const fileFindMany = vi.fn().mockResolvedValue([
      {
        name: 'spec.md',
        mimeType: 'text/markdown',
        size: 256,
        path: 'threads/t1/spec.md',
        scope: 'THREAD',
      },
    ]);
    const summaries = [
      {
        content: 'Summary of prior conversation.',
        createdAt: new Date('2026-02-23T12:00:00Z'),
      },
    ];
    const historyMessages = [{ role: 'user', content: 'Recent message', createdAt: new Date('2026-02-23T13:00:00Z') }];
    const summaryFindMany = vi.fn().mockResolvedValue(summaries);
    const findMany = vi.fn().mockResolvedValue(historyMessages);

    const ctx = createMockContext({ findMany, summaryFindMany, fileFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'Current prompt');

    expect(result).toBeDefined();
    const text = result ?? '';
    const filesIdx = text.indexOf('# Available Files');
    const summaryIdx = text.indexOf('# Prior Conversation Summary');
    const historyIdx = text.indexOf('# Conversation History');
    const promptIdx = text.indexOf('Current prompt');

    expect(filesIdx).toBeLessThan(summaryIdx);
    expect(summaryIdx).toBeLessThan(historyIdx);
    expect(historyIdx).toBeLessThan(promptIdx);
  });

  it('injects project instructions before file references', async () => {
    const fileFindMany = vi.fn().mockResolvedValue([
      {
        name: 'doc.md',
        mimeType: 'text/markdown',
        size: 128,
        path: 'threads/t1/doc.md',
        scope: 'THREAD',
      },
    ]);
    const threadFindUnique = vi.fn().mockResolvedValue({
      sessionId: null,
      projectId: 'p1',
      project: { instructions: 'Always respond in formal English.', memory: null },
    });

    const ctx = createMockContext({ threadFindUnique, fileFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'User message');

    expect(result).toBeDefined();
    const text = result ?? '';
    expect(text).toContain('<project_instructions>');
    expect(text).toContain('Always respond in formal English.');

    const instructionsIdx = text.indexOf('<project_instructions>');
    const filesIdx = text.indexOf('# Available Files');
    expect(instructionsIdx).toBeLessThan(filesIdx);
  });

  it('injects project memory after instructions but before file references', async () => {
    const fileFindMany = vi.fn().mockResolvedValue([
      {
        name: 'doc.md',
        mimeType: 'text/markdown',
        size: 128,
        path: 'threads/t1/doc.md',
        scope: 'THREAD',
      },
    ]);
    const threadFindUnique = vi.fn().mockResolvedValue({
      sessionId: null,
      projectId: 'p1',
      project: {
        instructions: 'Project instructions here.',
        memory: 'User prefers concise answers.',
      },
    });

    const ctx = createMockContext({ threadFindUnique, fileFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'User message');

    expect(result).toBeDefined();
    const text = result ?? '';
    expect(text).toContain('<project_memory>');
    expect(text).toContain('User prefers concise answers.');

    const instructionsIdx = text.indexOf('<project_instructions>');
    const memoryIdx = text.indexOf('<project_memory>');
    const filesIdx = text.indexOf('# Available Files');
    expect(instructionsIdx).toBeLessThan(memoryIdx);
    expect(memoryIdx).toBeLessThan(filesIdx);
  });

  it('output is unchanged when thread has no project and no files', async () => {
    const findMany = vi.fn().mockResolvedValue([{ role: 'user', content: 'Hello', createdAt: new Date() }]);

    const ctx = createMockContext({ findMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'Current message');

    expect(result).toBeDefined();
    const text = result ?? '';
    expect(text).not.toContain('<project_instructions>');
    expect(text).not.toContain('<project_memory>');
    expect(text).not.toContain('# Available Files');
    expect(text).toContain('# Conversation History');
    expect(text).toContain('Current message');
  });

  it('omits project sections when instructions and memory are null', async () => {
    const threadFindUnique = vi.fn().mockResolvedValue({
      sessionId: null,
      projectId: 'p1',
      project: { instructions: null, memory: null },
    });

    const ctx = createMockContext({ threadFindUnique });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'Just a prompt');

    expect(result).toBeDefined();
    const text = result ?? '';
    expect(text).not.toContain('<project_instructions>');
    expect(text).not.toContain('<project_memory>');
    expect(text).toContain('Just a prompt');
  });

  it('separates sections with dividers', async () => {
    const fileFindMany = vi.fn().mockResolvedValue([
      {
        name: 'spec.md',
        mimeType: 'text/markdown',
        size: 256,
        path: 'threads/t1/spec.md',
        scope: 'THREAD',
      },
    ]);
    const findMany = vi.fn().mockResolvedValue([{ role: 'user', content: 'Msg', createdAt: new Date() }]);

    const ctx = createMockContext({ findMany, fileFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('t1', 'Current');

    expect(result).toBeDefined();
    const text = result ?? '';
    const dividerCount = (text.match(/\n\n---\n\n/g) ?? []).length;
    expect(dividerCount).toBeGreaterThanOrEqual(2);
  });

  it('continues without file references when file query throws', async () => {
    const fileFindMany = vi.fn().mockRejectedValue(new Error('File table locked'));
    const findMany = vi.fn().mockResolvedValue([{ role: 'user', content: 'Hello', createdAt: new Date('2026-02-23T12:00:00Z') }]);

    const ctx = createMockContext({ findMany, fileFindMany });
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'My prompt');

    expect(result).toContain('My prompt');
    expect(result).toContain('# Conversation History');
    expect(result).not.toContain('# Available Files');
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('File table locked'));
  });

  it('uses custom settings values for history and summary limits', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const summaryFindMany = vi.fn().mockResolvedValue([{ content: 'Summary.', createdAt: new Date('2026-02-23T12:00:00Z') }]);

    const ctx = createMockContext({ findMany, summaryFindMany });
    (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
      historyLimit: 100,
      historyLimitWithSummary: 10,
      summaryLookback: 5,
    });
    const hooks = await plugin.register(ctx);
    await plugin.start!(ctx);

    await hooks.onBeforeInvoke?.('thread-1', 'prompt');

    // summaryLookback: 5
    expect(ctx.db.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    // historyLimitWithSummary: 10 (summaries exist)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });

  it('reloads settings on onSettingsChange for context plugin', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);
    await plugin.start!(ctx);

    await hooks.onSettingsChange?.('context');

    expect(ctx.getSettings).toHaveBeenCalledTimes(2); // once on start, once on reload
    expect(ctx.logger.info).toHaveBeenCalledWith('Context plugin: settings reloaded');
  });

  it('ignores onSettingsChange for other plugins', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);
    await plugin.start!(ctx);

    await hooks.onSettingsChange?.('cron');

    expect(ctx.getSettings).toHaveBeenCalledTimes(1); // only on start
  });
});
