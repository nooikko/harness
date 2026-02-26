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
  ctx: { db: {}, invoker: {}, config: {}, logger: {}, sendToThread: vi.fn(), broadcast: vi.fn() } as unknown as PluginContext,
  threadId: 'thread-1',
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

    expect(handler).toHaveBeenCalledWith(contextRef.ctx, input, { threadId: 'thread-42' } satisfies PluginToolMeta);
    expect(result).toEqual({ content: [{ type: 'text', text: 'tool output' }] });
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

    await expect(mcpTool.handler({})).rejects.toThrow('PluginContext not initialized');
  });
});
