import type { SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { PluginContext, PluginDefinition, PluginTool, PluginToolMeta } from '@harness/plugin-contract';

export type CollectedTool = PluginTool & {
  pluginName: string;
  qualifiedName: string;
};

export type ToolContextRef = {
  ctx: PluginContext | null;
  threadId: string;
};

type CollectTools = (plugins: PluginDefinition[]) => CollectedTool[];

export const collectTools: CollectTools = (plugins) => {
  return plugins.flatMap((p) =>
    (p.tools ?? []).map((t) => ({
      ...t,
      pluginName: p.name,
      qualifiedName: `${p.name}__${t.name}`,
    })),
  );
};

type CreateToolServer = (tools: CollectedTool[], contextRef: ToolContextRef) => ReturnType<typeof createSdkMcpServer> | null;

export const createToolServer: CreateToolServer = (tools, contextRef) => {
  if (tools.length === 0) {
    return null;
  }

  // Build SdkMcpToolDefinition objects directly to bridge between
  // plugin contract's JSON Schema (Record<string, unknown>) and the SDK's Zod types.
  // At runtime the MCP server serializes schemas to JSON Schema for the protocol,
  // so plain JSON Schema objects work correctly despite the Zod type signature.
  const mcpTools: Array<SdkMcpToolDefinition<Record<string, never>>> = tools.map((t) => ({
    name: t.qualifiedName,
    description: t.description,
    inputSchema: t.schema as Record<string, never>,
    handler: async (input: Record<string, unknown>) => {
      if (!contextRef.ctx) {
        throw new Error('PluginContext not initialized');
      }
      const meta: PluginToolMeta = { threadId: contextRef.threadId };
      const result = await t.handler(contextRef.ctx, input, meta);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  }));

  return createSdkMcpServer({
    name: 'harness',
    tools: mcpTools,
  });
};
