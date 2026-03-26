import type { PluginContext, PluginDefinition, PluginTool, PluginToolMeta } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  createSdkMcpServer: vi.fn((options: { name: string; tools: unknown[] }) => ({
    name: options.name,
    tools: options.tools,
  })),
}));

import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { ToolContextRef } from '../index';
import { collectTools, createToolServer } from '../index';

const mockCreateSdkMcpServer = vi.mocked(createSdkMcpServer);

const makeHandler = () => vi.fn().mockResolvedValue('result');

const makeTool = (name: string): PluginTool => ({
  name,
  description: `Description for ${name}`,
  schema: { type: 'object', properties: { input: { type: 'string' } } },
  handler: makeHandler(),
});

const makePlugin = (name: string, tools?: PluginTool[]): PluginDefinition => ({
  name,
  version: '1.0.0',
  register: vi.fn().mockResolvedValue({}),
  tools,
});

const makeContextRef = (overrides?: Partial<ToolContextRef>): ToolContextRef => ({
  ctx: {
    db: {},
    invoker: {},
    config: {},
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    sendToThread: vi.fn(),
    broadcast: vi.fn(),
  } as unknown as PluginContext,
  threadId: 'thread-1',
  pendingBlocks: [],
  ...overrides,
});

describe('collectTools', () => {
  it('returns empty array when no plugins have tools', () => {
    const plugins = [makePlugin('a'), makePlugin('b')];
    const result = collectTools(plugins);
    expect(result).toEqual([]);
  });

  it('collects tools from plugins that have them', () => {
    const delegateTool = makeTool('delegate');
    const checkinTool = makeTool('checkin');
    const plugins = [makePlugin('delegation', [delegateTool, checkinTool]), makePlugin('context')];
    const result = collectTools(plugins);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      ...delegateTool,
      pluginName: 'delegation',
      qualifiedName: 'delegation__delegate',
    });
    expect(result[1]).toEqual({
      ...checkinTool,
      pluginName: 'delegation',
      qualifiedName: 'delegation__checkin',
    });
  });

  it('collects tools from multiple plugins', () => {
    const plugins = [makePlugin('delegation', [makeTool('delegate')]), makePlugin('cron', [makeTool('cron_create'), makeTool('cron_delete')])];
    const result = collectTools(plugins);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.qualifiedName)).toEqual(['delegation__delegate', 'cron__cron_create', 'cron__cron_delete']);
  });

  it('skips plugins with empty tools array', () => {
    const plugins = [makePlugin('empty', [])];
    const result = collectTools(plugins);
    expect(result).toEqual([]);
  });
});

describe('createToolServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no tools are collected', () => {
    const result = createToolServer([], makeContextRef());
    expect(result).toBeNull();
    expect(mockCreateSdkMcpServer).not.toHaveBeenCalled();
  });

  it('creates an MCP server with qualified tool names', () => {
    const delegateTool = makeTool('delegate');
    const collected = [
      {
        ...delegateTool,
        pluginName: 'delegation',
        qualifiedName: 'delegation__delegate',
      },
    ];

    createToolServer(collected, makeContextRef());

    expect(mockCreateSdkMcpServer).toHaveBeenCalledWith({
      name: 'harness',
      tools: [
        expect.objectContaining({
          name: 'delegation__delegate',
          description: delegateTool.description,
        }),
      ],
    });
  });

  it('returns the MCP server instance', () => {
    const collected = [
      {
        ...makeTool('delegate'),
        pluginName: 'delegation',
        qualifiedName: 'delegation__delegate',
      },
    ];
    const result = createToolServer(collected, makeContextRef());
    expect(result).not.toBeNull();
  });

  it('handler calls plugin handler with (ctx, input, meta)', async () => {
    const handler = vi.fn().mockResolvedValue('tool output');
    const tool: PluginTool = {
      name: 'test-tool',
      description: 'A test tool',
      schema: { type: 'object' },
      handler,
    };
    const collected = [{ ...tool, pluginName: 'test', qualifiedName: 'test__test-tool' }];
    const contextRef = makeContextRef({ threadId: 'thread-42' });

    createToolServer(collected, contextRef);

    type McpHandler = (input: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
    const mockCallParams = mockCreateSdkMcpServer.mock.calls[0] as unknown as Parameters<typeof createSdkMcpServer>;
    const mcpTools = mockCallParams[0].tools as unknown as Array<{ handler: McpHandler }>;
    const mcpTool = mcpTools[0]!;

    const input = { prompt: 'hello' };
    const result = await mcpTool.handler(input);

    const calledMeta = handler.mock.calls[0]![2] as PluginToolMeta;
    expect(calledMeta.threadId).toBe('thread-42');
    expect(typeof calledMeta.reportProgress).toBe('function');
    expect(result).toEqual({ content: [{ type: 'text', text: 'tool output' }] });
  });

  it('handler includes taskId in meta when contextRef has taskId', async () => {
    const handler = vi.fn().mockResolvedValue('task output');
    const tool: PluginTool = {
      name: 'test-tool',
      description: 'A test tool',
      schema: { type: 'object' },
      handler,
    };
    const collected = [{ ...tool, pluginName: 'test', qualifiedName: 'test__test-tool' }];
    const contextRef = makeContextRef({ threadId: 'thread-42', taskId: 'task-99' });

    createToolServer(collected, contextRef);

    type McpHandler = (input: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
    const mockCallParams = mockCreateSdkMcpServer.mock.calls[0] as unknown as Parameters<typeof createSdkMcpServer>;
    const mcpTools = mockCallParams[0].tools as unknown as Array<{ handler: McpHandler }>;
    const mcpTool = mcpTools[0]!;

    await mcpTool.handler({ prompt: 'hello' });

    const calledMeta = handler.mock.calls[0]![2] as PluginToolMeta;
    expect(calledMeta.threadId).toBe('thread-42');
    expect(calledMeta.taskId).toBe('task-99');
    expect(typeof calledMeta.reportProgress).toBe('function');
  });

  it('handler omits taskId from meta when contextRef has no taskId', async () => {
    const handler = vi.fn().mockResolvedValue('output');
    const tool: PluginTool = {
      name: 'test-tool',
      description: 'A test tool',
      schema: { type: 'object' },
      handler,
    };
    const collected = [{ ...tool, pluginName: 'test', qualifiedName: 'test__test-tool' }];
    const contextRef = makeContextRef({ threadId: 'thread-42' });

    createToolServer(collected, contextRef);

    type McpHandler = (input: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
    const mockCallParams = mockCreateSdkMcpServer.mock.calls[0] as unknown as Parameters<typeof createSdkMcpServer>;
    const mcpTools = mockCallParams[0].tools as unknown as Array<{ handler: McpHandler }>;
    const mcpTool = mcpTools[0]!;

    await mcpTool.handler({});

    const calledMeta = handler.mock.calls[0]![2] as PluginToolMeta;
    expect(calledMeta.taskId).toBeUndefined();
  });

  it('handler throws when PluginContext is not initialized', async () => {
    const tool = makeTool('test-tool');
    const collected = [{ ...tool, pluginName: 'test', qualifiedName: 'test__test-tool' }];
    const contextRef = makeContextRef({ ctx: null });

    createToolServer(collected, contextRef);

    const mockCallParams = mockCreateSdkMcpServer.mock.calls[0] as unknown as Parameters<typeof createSdkMcpServer>;
    const mcpTools = mockCallParams[0].tools as unknown as Array<{
      handler: (input: Record<string, unknown>) => Promise<unknown>;
    }>;
    const mcpTool = mcpTools[0]!;

    await expect(mcpTool.handler({})).rejects.toThrow(
      'Tool "test__test-tool" called before PluginContext was initialized. This can happen if a tool is called before plugin registration completes.',
    );
  });

  it('passes a Zod shape (not raw JSON Schema) as inputSchema', () => {
    const tool = makeTool('delegate');
    // makeTool uses schema: { type: 'object', properties: { input: { type: 'string' } } }
    const collected = [{ ...tool, pluginName: 'delegation', qualifiedName: 'delegation__delegate' }];

    createToolServer(collected, makeContextRef());

    const callArgs = mockCreateSdkMcpServer.mock.calls[0]![0];
    const passedTool = callArgs.tools![0]! as { inputSchema: Record<string, unknown> };

    // POSITIVE: the Zod shape must have the 'input' key from the schema properties
    expect(passedTool.inputSchema).toHaveProperty('input');

    // NEGATIVE: inputSchema must NOT be the raw JSON Schema (which would cause safeParseAsync TypeError)
    expect(passedTool.inputSchema).not.toHaveProperty('type', 'object');
    expect(passedTool.inputSchema).not.toHaveProperty('properties');
  });

  it('handler does not push to pendingBlocks when tool returns a plain string', async () => {
    const handler = vi.fn().mockResolvedValue('plain string result');
    const tool: PluginTool = {
      name: 'test-tool',
      description: 'A test tool',
      schema: { type: 'object' },
      handler,
    };
    const collected = [{ ...tool, pluginName: 'test', qualifiedName: 'test__test-tool' }];
    const contextRef = makeContextRef();

    createToolServer(collected, contextRef);

    type McpHandler = (input: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
    const mockCallParams = mockCreateSdkMcpServer.mock.calls[0] as unknown as Parameters<typeof createSdkMcpServer>;
    const mcpTools = mockCallParams[0].tools as unknown as Array<{ handler: McpHandler }>;
    const mcpTool = mcpTools[0]!;

    const result = await mcpTool.handler({});

    expect(result).toEqual({ content: [{ type: 'text', text: 'plain string result' }] });
    expect(contextRef.pendingBlocks).toHaveLength(0);
  });

  it('handler pushes blocks to pendingBlocks and returns text when tool returns a ToolResult object', async () => {
    const blocks = [{ type: 'email-list', data: { emails: [] } }];
    const handler = vi.fn().mockResolvedValue({ text: 'found 0 emails', blocks });
    const tool: PluginTool = {
      name: 'test-tool',
      description: 'A test tool',
      schema: { type: 'object' },
      handler,
    };
    const collected = [{ ...tool, pluginName: 'test', qualifiedName: 'test__test-tool' }];
    const contextRef = makeContextRef();

    createToolServer(collected, contextRef);

    type McpHandler = (input: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
    const mockCallParams = mockCreateSdkMcpServer.mock.calls[0] as unknown as Parameters<typeof createSdkMcpServer>;
    const mcpTools = mockCallParams[0].tools as unknown as Array<{ handler: McpHandler }>;
    const mcpTool = mcpTools[0]!;

    const result = await mcpTool.handler({});

    // SDK receives only the text portion
    expect(result).toEqual({ content: [{ type: 'text', text: 'found 0 emails' }] });
    // Blocks are queued on contextRef for the pipeline to consume
    expect(contextRef.pendingBlocks).toHaveLength(1);
    expect(contextRef.pendingBlocks[0]).toEqual(blocks);
  });

  it('handler does not push to pendingBlocks when ToolResult object has an empty blocks array', async () => {
    const handler = vi.fn().mockResolvedValue({ text: 'no blocks', blocks: [] });
    const tool: PluginTool = {
      name: 'test-tool',
      description: 'A test tool',
      schema: { type: 'object' },
      handler,
    };
    const collected = [{ ...tool, pluginName: 'test', qualifiedName: 'test__test-tool' }];
    const contextRef = makeContextRef();

    createToolServer(collected, contextRef);

    type McpHandler = (input: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
    const mockCallParams = mockCreateSdkMcpServer.mock.calls[0] as unknown as Parameters<typeof createSdkMcpServer>;
    const mcpTools = mockCallParams[0].tools as unknown as Array<{ handler: McpHandler }>;
    const mcpTool = mcpTools[0]!;

    await mcpTool.handler({});

    expect(contextRef.pendingBlocks).toHaveLength(0);
  });

  it('accumulates multiple block arrays across sequential tool calls', async () => {
    const blocks1 = [{ type: 'email-list', data: { emails: ['a@b.com'] } }];
    const blocks2 = [{ type: 'calendar-event', data: { title: 'Meeting' } }];

    const handler1 = vi.fn().mockResolvedValue({ text: 'result 1', blocks: blocks1 });
    const handler2 = vi.fn().mockResolvedValue({ text: 'result 2', blocks: blocks2 });

    const tool1: PluginTool = { name: 'tool-a', description: 'Tool A', schema: { type: 'object' }, handler: handler1 };
    const tool2: PluginTool = { name: 'tool-b', description: 'Tool B', schema: { type: 'object' }, handler: handler2 };

    const collected = [
      { ...tool1, pluginName: 'test', qualifiedName: 'test__tool-a' },
      { ...tool2, pluginName: 'test', qualifiedName: 'test__tool-b' },
    ];
    const contextRef = makeContextRef();

    createToolServer(collected, contextRef);

    type McpHandler = (input: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
    const mockCallParams = mockCreateSdkMcpServer.mock.calls[0] as unknown as Parameters<typeof createSdkMcpServer>;
    const mcpTools = mockCallParams[0].tools as unknown as Array<{ handler: McpHandler }>;

    await mcpTools[0]!.handler({});
    await mcpTools[1]!.handler({});

    expect(contextRef.pendingBlocks).toHaveLength(2);
    expect(contextRef.pendingBlocks[0]).toEqual(blocks1);
    expect(contextRef.pendingBlocks[1]).toEqual(blocks2);
  });

  it('injects reportProgress into meta and flushes progress events to onToolProgress', async () => {
    const handler = vi.fn().mockImplementation(async (_ctx: PluginContext, _input: Record<string, unknown>, meta: PluginToolMeta) => {
      meta.reportProgress?.('Step 1/2', { current: 1, total: 2 });
      meta.reportProgress?.('Step 2/2', { current: 2, total: 2 });
      return 'done';
    });
    const tool: PluginTool = {
      name: 'heavy-tool',
      description: 'A heavy tool',
      schema: { type: 'object' },
      handler,
    };
    const collected = [{ ...tool, pluginName: 'test', qualifiedName: 'test__heavy-tool' }];
    const onToolProgress = vi.fn();
    const contextRef = makeContextRef({ threadId: 'thread-42', traceId: 'trace-1', onToolProgress });

    createToolServer(collected, contextRef);

    type McpHandler = (input: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
    const mockCallParams = mockCreateSdkMcpServer.mock.calls[0] as unknown as Parameters<typeof createSdkMcpServer>;
    const mcpTools = mockCallParams[0].tools as unknown as Array<{ handler: McpHandler }>;

    await mcpTools[0]!.handler({});

    // Progress events should have been flushed to onToolProgress
    expect(onToolProgress).toHaveBeenCalledTimes(2);
    expect(onToolProgress.mock.calls[0]![0]).toEqual(
      expect.objectContaining({ type: 'tool_progress', toolName: 'test__heavy-tool', content: 'Step 1/2' }),
    );
    expect(onToolProgress.mock.calls[1]![0]).toEqual(
      expect.objectContaining({ type: 'tool_progress', toolName: 'test__heavy-tool', content: 'Step 2/2' }),
    );
  });

  it('flushes progress events even when handler throws', async () => {
    const handler = vi.fn().mockImplementation(async (_ctx: PluginContext, _input: Record<string, unknown>, meta: PluginToolMeta) => {
      meta.reportProgress?.('Started');
      throw new Error('Something went wrong');
    });
    const tool: PluginTool = {
      name: 'failing-tool',
      description: 'A failing tool',
      schema: { type: 'object' },
      handler,
    };
    const collected = [{ ...tool, pluginName: 'test', qualifiedName: 'test__failing-tool' }];
    const onToolProgress = vi.fn();
    const contextRef = makeContextRef({ threadId: 'thread-42', onToolProgress });

    createToolServer(collected, contextRef);

    type McpHandler = (input: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
    const mockCallParams = mockCreateSdkMcpServer.mock.calls[0] as unknown as Parameters<typeof createSdkMcpServer>;
    const mcpTools = mockCallParams[0].tools as unknown as Array<{ handler: McpHandler }>;

    const result = await mcpTools[0]!.handler({});

    expect(result.isError).toBe(true);
    expect(onToolProgress).toHaveBeenCalledTimes(1);
    expect(onToolProgress.mock.calls[0]![0]).toEqual(expect.objectContaining({ type: 'tool_progress', content: 'Started' }));
  });
});
