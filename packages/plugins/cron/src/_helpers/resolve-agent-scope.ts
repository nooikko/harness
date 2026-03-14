import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';

type AgentScope = {
  agentId: string;
};

type ResolveAgentScopeResult = { ok: true; scope: AgentScope } | { ok: false; error: string };

type ResolveAgentScope = (ctx: PluginContext, meta: PluginToolMeta) => Promise<ResolveAgentScopeResult>;

export const resolveAgentScope: ResolveAgentScope = async (ctx, meta) => {
  const thread = await ctx.db.thread.findUnique({
    where: { id: meta.threadId },
    select: { agentId: true },
  });

  if (!thread) {
    return { ok: false, error: 'Error: could not resolve calling thread.' };
  }

  if (!thread.agentId) {
    return { ok: false, error: 'Error: thread has no associated agent.' };
  }

  return { ok: true, scope: { agentId: thread.agentId } };
};
