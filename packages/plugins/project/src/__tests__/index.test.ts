import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { projectPlugin } from '../index';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () => ({
  db: {
    thread: {
      findUnique: vi.fn(),
    },
    project: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
  } as never,
  invoker: { invoke: vi.fn() },
  config: {
    claudeModel: 'sonnet',
    databaseUrl: '',
    timezone: 'America/Phoenix',
    maxConcurrentAgents: 5,
    claudeTimeout: 30000,
    discordToken: undefined,
    discordChannelId: undefined,
    port: 3001,
    logLevel: 'info',
    uploadDir: '/tmp/uploads',
  } as never,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  sendToThread: vi.fn(),
  broadcast: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({}),
  notifySettingsChange: vi.fn().mockResolvedValue(undefined),
  reportStatus: vi.fn(),
});

describe('project plugin', () => {
  it('has correct name and version', () => {
    expect(projectPlugin.name).toBe('project');
    expect(projectPlugin.version).toBe('1.0.0');
  });

  it('register returns empty hooks object', async () => {
    const ctx = createMockContext();
    const hooks = await projectPlugin.register(ctx);
    expect(hooks).toEqual({});
  });

  it('defines two tools', () => {
    expect(projectPlugin.tools).toBeDefined();
    expect(projectPlugin.tools).toHaveLength(2);
    expect(projectPlugin.tools?.[0]?.name).toBe('get_project_memory');
    expect(projectPlugin.tools?.[1]?.name).toBe('set_project_memory');
  });
});

describe('get_project_memory tool', () => {
  it('returns memory string when thread has a project with memory', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      project: { memory: '# My Project\n\nKey facts here.' },
    } as never);

    const tool = projectPlugin.tools?.[0];
    const result = await tool?.handler(ctx, {}, { threadId: 'thread-1' });

    expect(result).toBe('# My Project\n\nKey facts here.');
    expect(ctx.db.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      select: { project: { select: { memory: true } } },
    });
  });

  it("returns '(no project memory)' when project.memory is null", async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      project: { memory: null },
    } as never);

    const tool = projectPlugin.tools?.[0];
    const result = await tool?.handler(ctx, {}, { threadId: 'thread-1' });

    expect(result).toBe('(no project memory)');
  });

  it("returns '(thread has no associated project)' when thread.project is null", async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      project: null,
    } as never);

    const tool = projectPlugin.tools?.[0];
    const result = await tool?.handler(ctx, {}, { threadId: 'thread-1' });

    expect(result).toBe('(thread has no associated project)');
  });

  it("returns '(thread not found)' when thread does not exist", async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue(null);

    const tool = projectPlugin.tools?.[0];
    const result = await tool?.handler(ctx, {}, { threadId: 'thread-1' });

    expect(result).toBe('(thread not found)');
  });
});

describe('set_project_memory tool', () => {
  it('updates project memory and returns success message', async () => {
    const ctx = createMockContext();
    const updatedAt = new Date('2026-01-01T00:00:00Z');
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'project-abc',
      project: { updatedAt },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockResolvedValue({ count: 1 } as never);

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: '# Updated Memory\n\nNew facts.' }, { threadId: 'thread-1' });

    expect(result).toBe('Project memory updated.');
    expect(ctx.db.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      select: { projectId: true, project: { select: { updatedAt: true } } },
    });
    expect(ctx.db.project.updateMany).toHaveBeenCalledWith({
      where: { id: 'project-abc', updatedAt },
      data: { memory: '# Updated Memory\n\nNew facts.' },
    });
  });

  it("returns '(thread has no associated project)' when thread has no projectId", async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: null,
      project: null,
    } as never);

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: 'some memory' }, { threadId: 'thread-1' });

    expect(result).toBe('(thread has no associated project)');
    expect(ctx.db.project.updateMany).not.toHaveBeenCalled();
  });

  it("returns '(thread not found)' when thread does not exist", async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue(null);

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: 'some memory' }, { threadId: 'thread-1' });

    expect(result).toBe('(thread not found)');
    expect(ctx.db.project.updateMany).not.toHaveBeenCalled();
  });

  it('returns error message for non-string memory input', async () => {
    const ctx = createMockContext();

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: 42 }, { threadId: 'thread-1' });

    expect(result).toBe('(invalid input: memory must be a string)');
    expect(ctx.db.thread.findUnique).not.toHaveBeenCalled();
    expect(ctx.db.project.updateMany).not.toHaveBeenCalled();
  });

  it('returns error message when input is null', async () => {
    const ctx = createMockContext();

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, null as never, { threadId: 'thread-1' });

    expect(result).toBe('(invalid input: memory must be a string)');
    expect(ctx.db.thread.findUnique).not.toHaveBeenCalled();
    expect(ctx.db.project.updateMany).not.toHaveBeenCalled();
  });

  it('returns error message when memory key is missing from input', async () => {
    const ctx = createMockContext();

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, {}, { threadId: 'thread-1' });

    expect(result).toBe('(invalid input: memory must be a string)');
    expect(ctx.db.thread.findUnique).not.toHaveBeenCalled();
    expect(ctx.db.project.updateMany).not.toHaveBeenCalled();
  });

  it('accepts empty string memory and clears project memory', async () => {
    const ctx = createMockContext();
    const updatedAt = new Date('2026-01-01T00:00:00Z');
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'project-abc',
      project: { updatedAt },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockResolvedValue({ count: 1 } as never);

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: '' }, { threadId: 'thread-1' });

    expect(result).toBe('Project memory updated.');
    expect(ctx.db.project.updateMany).toHaveBeenCalledWith({
      where: { id: 'project-abc', updatedAt },
      data: { memory: '' },
    });
  });

  it("returns '(project was deleted before memory could be saved)' when updateMany matches nothing and project is gone", async () => {
    const ctx = createMockContext();
    const updatedAt = new Date('2026-01-01T00:00:00Z');
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'project-abc',
      project: { updatedAt },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(ctx.db.project.findUnique).mockResolvedValue(null);

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: 'new memory' }, { threadId: 'thread-1' });

    expect(result).toBe('(project was deleted before memory could be saved)');
    expect(ctx.db.project.findUnique).toHaveBeenCalledWith({
      where: { id: 'project-abc' },
      select: { id: true },
    });
  });

  it("returns '(failed to save project memory — database error)' when updateMany throws", async () => {
    const ctx = createMockContext();
    const updatedAt = new Date('2026-01-01T00:00:00Z');
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'project-abc',
      project: { updatedAt },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockRejectedValue(new Error('connection lost'));

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: 'new memory' }, { threadId: 'thread-1' });

    expect(result).toBe('(failed to save project memory — database error)');
    expect(ctx.db.project.findUnique).not.toHaveBeenCalled();
  });

  it("returns '(failed to save project memory — database error)' when fallback findUnique throws", async () => {
    const ctx = createMockContext();
    const updatedAt = new Date('2026-01-01T00:00:00Z');
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'project-abc',
      project: { updatedAt },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(ctx.db.project.findUnique).mockRejectedValue(new Error('connection lost'));

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: 'new memory' }, { threadId: 'thread-1' });

    expect(result).toBe('(failed to save project memory — database error)');
  });

  it("returns '(project memory was modified concurrently — call get_project_memory again and retry)' when updateMany matches nothing but project still exists", async () => {
    const ctx = createMockContext();
    const updatedAt = new Date('2026-01-01T00:00:00Z');
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'project-abc',
      project: { updatedAt },
    } as never);
    vi.mocked(ctx.db.project.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(ctx.db.project.findUnique).mockResolvedValue({ id: 'project-abc' } as never);

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: 'new memory' }, { threadId: 'thread-1' });

    expect(result).toBe('(project memory was modified concurrently — call get_project_memory again and retry)');
  });
});
