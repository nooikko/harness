import type { PluginContext, PluginDefinition } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/claude-agent-sdk', () => {
  return {
    createSdkMcpServer: vi.fn((opts: { name: string; tools: unknown[] }) => {
      return { name: opts.name, tools: opts.tools };
    }),
  };
});

import type { ToolContextRef } from '../index';
import { collectTools, createToolServer } from '../index';

type MakePlugin = (name: string, tools?: PluginDefinition['tools']) => PluginDefinition;

const makePlugin: MakePlugin = (name, tools) => ({
  name,
  version: '1.0.0',
  register: vi.fn().mockResolvedValue({}),
  tools,
});

const makeContextRef = (): ToolContextRef => ({
  ctx: { db: {}, invoker: {}, config: {}, logger: {}, sendToThread: vi.fn(), broadcast: vi.fn() } as unknown as PluginContext,
  threadId: 'thread-1',
});

describe('tool-server integration', () => {
  it('full pipeline: plugins -> collectTools -> createToolServer -> MCP server', () => {
    const plugins = [
      makePlugin('delegation', [
        {
          name: 'delegate',
          description: 'Spawn a sub-agent',
          schema: {
            type: 'object',
            properties: { prompt: { type: 'string' } },
            required: ['prompt'],
          },
          handler: vi.fn().mockResolvedValue('delegated'),
        },
        {
          name: 'checkin',
          description: 'Send progress update',
          schema: {
            type: 'object',
            properties: { message: { type: 'string' } },
            required: ['message'],
          },
          handler: vi.fn().mockResolvedValue('checked in'),
        },
      ]),
      makePlugin('context'),
      makePlugin('web'),
    ];

    const collected = collectTools(plugins);
    expect(collected).toHaveLength(2);
    expect(collected[0]!.qualifiedName).toBe('delegation__delegate');
    expect(collected[1]!.qualifiedName).toBe('delegation__checkin');

    const server = createToolServer(collected, makeContextRef());
    expect(server).not.toBeNull();
    expect((server as { name: string }).name).toBe('harness');
  });

  it('returns null server when no plugins have tools', () => {
    const plugins = [makePlugin('context'), makePlugin('web')];
    const collected = collectTools(plugins);
    const server = createToolServer(collected, makeContextRef());
    expect(server).toBeNull();
  });
});
