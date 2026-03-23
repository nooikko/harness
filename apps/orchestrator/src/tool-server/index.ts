import type { SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk';
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { ContentBlock, PluginContext, PluginDefinition, PluginTool, PluginToolMeta } from '@harness/plugin-contract';
import { ToolError } from '@harness/plugin-contract';
import type { ZodTypeAny } from 'zod';
import { jsonSchemaToZodShape } from './_helpers/json-schema-to-zod-shape';

export type CollectedTool = PluginTool & {
  pluginName: string;
  qualifiedName: string;
};

export type ToolContextRef = {
  ctx: PluginContext | null;
  threadId: string;
  traceId?: string;
  taskId?: string;
  pendingBlocks: ContentBlock[][];
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
        throw new Error(
          `Tool "${t.qualifiedName}" called before PluginContext was initialized. This can happen if a tool is called before plugin registration completes.`,
        );
      }
      const meta: PluginToolMeta = {
        threadId: contextRef.threadId,
        traceId: contextRef.traceId,
        ...(contextRef.taskId ? { taskId: contextRef.taskId } : {}),
      };
      try {
        const raw = await t.handler(contextRef.ctx, input, meta);
        const text = typeof raw === 'string' ? raw : raw.text;
        if (typeof raw !== 'string' && raw.blocks.length > 0) {
          contextRef.pendingBlocks.push(raw.blocks);
        }
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const code = err instanceof ToolError ? err.code : 'INTERNAL_ERROR';
        const message = err instanceof Error ? err.message : String(err);
        contextRef.ctx.logger.error(`Tool "${t.qualifiedName}" failed [${code}]: ${message}`, {
          toolName: t.qualifiedName,
          pluginName: t.pluginName,
          code,
          threadId: meta.threadId,
          traceId: meta.traceId,
        });
        return { content: [{ type: 'text' as const, text: `[${code}] ${message}` }], isError: true };
      }
    },
  }));

  return createSdkMcpServer({
    name: 'harness',
    tools: mcpTools,
  });
};
