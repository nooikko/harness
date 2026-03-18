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

  it("returns '(thread has no associated project)' when thread has no project", async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      project: null,
    } as never);

    const tool = projectPlugin.tools?.[0];
    const result = await tool?.handler(ctx, {}, { threadId: 'thread-1' });

    expect(result).toBe('(thread has no associated project)');
  });

  it("returns '(thread has no associated project)' when thread is null", async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue(null);

    const tool = projectPlugin.tools?.[0];
    const result = await tool?.handler(ctx, {}, { threadId: 'thread-1' });

    expect(result).toBe('(thread has no associated project)');
  });
});

describe('set_project_memory tool', () => {
  it('updates project memory and returns success message', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: 'project-abc',
    } as never);
    vi.mocked(ctx.db.project.update).mockResolvedValue({} as never);

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: '# Updated Memory\n\nNew facts.' }, { threadId: 'thread-1' });

    expect(result).toBe('Project memory updated.');
    expect(ctx.db.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      select: { projectId: true },
    });
    expect(ctx.db.project.update).toHaveBeenCalledWith({
      where: { id: 'project-abc' },
      data: { memory: '# Updated Memory\n\nNew facts.' },
    });
  });

  it("returns '(thread has no associated project)' when thread has no projectId", async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({
      projectId: null,
    } as never);

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: 'some memory' }, { threadId: 'thread-1' });

    expect(result).toBe('(thread has no associated project)');
    expect(ctx.db.project.update).not.toHaveBeenCalled();
  });

  it("returns '(thread has no associated project)' when thread is null", async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue(null);

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: 'some memory' }, { threadId: 'thread-1' });

    expect(result).toBe('(thread has no associated project)');
    expect(ctx.db.project.update).not.toHaveBeenCalled();
  });

  it('returns error message for non-string memory input', async () => {
    const ctx = createMockContext();

    const tool = projectPlugin.tools?.[1];
    const result = await tool?.handler(ctx, { memory: 42 }, { threadId: 'thread-1' });

    expect(result).toBe('(invalid input: memory must be a string)');
    expect(ctx.db.thread.findUnique).not.toHaveBeenCalled();
    expect(ctx.db.project.update).not.toHaveBeenCalled();
  });
});
