import { describe, expect, it, vi } from 'vitest';
import { plugin as tasksPlugin } from '../index';

describe('tasksPlugin', () => {
  it('has the correct name', () => {
    expect(tasksPlugin.name).toBe('tasks');
  });

  it('has the correct version', () => {
    expect(tasksPlugin.version).toBe('1.0.0');
  });

  it('has 6 tools', () => {
    expect(tasksPlugin.tools).toHaveLength(6);
  });

  it('exposes add_task tool', () => {
    const tool = tasksPlugin.tools?.find((t) => t.name === 'add_task');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('Create a new task');
    expect(tool?.schema.required).toContain('title');
  });

  it('exposes list_tasks tool', () => {
    const tool = tasksPlugin.tools?.find((t) => t.name === 'list_tasks');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('List tasks');
  });

  it('exposes update_task tool', () => {
    const tool = tasksPlugin.tools?.find((t) => t.name === 'update_task');
    expect(tool).toBeDefined();
    expect(tool?.schema.required).toContain('id');
  });

  it('exposes complete_task tool', () => {
    const tool = tasksPlugin.tools?.find((t) => t.name === 'complete_task');
    expect(tool).toBeDefined();
    expect(tool?.schema.required).toContain('id');
  });

  it('exposes add_dependency tool', () => {
    const tool = tasksPlugin.tools?.find((t) => t.name === 'add_dependency');
    expect(tool).toBeDefined();
    expect(tool?.schema.required).toContain('taskId');
    expect(tool?.schema.required).toContain('blockedById');
  });

  it('exposes remove_dependency tool', () => {
    const tool = tasksPlugin.tools?.find((t) => t.name === 'remove_dependency');
    expect(tool).toBeDefined();
    expect(tool?.schema.required).toContain('taskId');
    expect(tool?.schema.required).toContain('blockedById');
  });

  it('register returns empty hooks', async () => {
    const mockCtx = {} as Parameters<typeof tasksPlugin.register>[0];
    const hooks = await tasksPlugin.register(mockCtx);
    expect(hooks).toEqual({});
  });

  it('add_task handler rejects missing title when invoked through the tool', async () => {
    const tool = tasksPlugin.tools?.find((t) => t.name === 'add_task');
    const mockCtx = {
      db: {
        thread: { findUnique: vi.fn().mockResolvedValue(null) },
        userTask: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
        userTaskDependency: { createMany: vi.fn() },
        $transaction: vi.fn(),
      },
      invoker: { invoke: vi.fn() },
      config: {},
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      sendToThread: vi.fn(),
      broadcast: vi.fn(),
      getSettings: vi.fn(),
      notifySettingsChange: vi.fn(),
      reportStatus: vi.fn(),
      reportBackgroundError: vi.fn(),
      runBackground: vi.fn(),
      uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
    } as Parameters<typeof tasksPlugin.register>[0];

    const result = await tool!.handler(mockCtx, {}, { threadId: 'thread-1' });

    expect(result).toBe('(invalid input: title is required)');
  });

  it('tool names are unique', () => {
    const names = tasksPlugin.tools?.map((t) => t.name) ?? [];
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});
