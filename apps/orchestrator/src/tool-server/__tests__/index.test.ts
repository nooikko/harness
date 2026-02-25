import type { PluginDefinition, PluginTool } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  createSdkMcpServer: vi.fn((options: { name: string; tools: unknown[] }) => ({
    name: options.name,
    tools: options.tools,
  })),
}));

import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
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
  it('returns null when no tools are collected', () => {
    const result = createToolServer([]);
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

    createToolServer(collected);

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
    const result = createToolServer(collected);
    expect(result).not.toBeNull();
  });
});
