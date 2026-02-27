import type { SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { PluginContext, PluginDefinition, PluginTool, PluginToolMeta } from '@harness/plugin-contract';
import type { ZodTypeAny } from 'zod';
import { jsonSchemaToZodShape } from './_helpers/json-schema-to-zod-shape';

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

  // Convert the plugin's JSON Schema to a Zod raw shape. The SDK uses Zod internally
  // to validate tool inputs at call time; plain JSON Schema objects cause a TypeError
  // because the SDK calls .safeParseAsync() on whatever is passed as inputSchema.
  // jsonSchemaToZodShape maps primitive types (string/number/integer/boolean) to Zod
  // equivalents and falls back to z.unknown() for complex/nested types.
  const mcpTools: Array<SdkMcpToolDefinition<Record<string, ZodTypeAny>>> = tools.map((t) => ({
    name: t.qualifiedName,
    description: t.description,
    inputSchema: jsonSchemaToZodShape(t.schema) as Record<string, ZodTypeAny>,
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
