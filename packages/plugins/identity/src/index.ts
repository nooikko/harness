// Identity plugin — injects agent soul, identity, and memories into prompts
// Writes episodic memories based on conversation importance after each invocation

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { formatIdentityAnchor } from './_helpers/format-identity-anchor';
import { formatIdentityHeader } from './_helpers/format-identity-header';
import { loadAgent } from './_helpers/load-agent';
import { loadAgentConfig } from './_helpers/load-agent-config';
import { retrieveMemories } from './_helpers/retrieve-memories';
import { scoreAndWriteMemory } from './_helpers/score-and-write-memory';

const SOUL_MAX_CHARS = 5000;
const IDENTITY_MAX_CHARS = 2000;
const MEMORY_LIMIT = 10;

export const plugin: PluginDefinition = {
  name: 'identity',
  version: '1.0.0',
  register: async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Identity plugin registered');

    return {
      onBeforeInvoke: async (threadId, prompt) => {
        const agent = await loadAgent(ctx.db, threadId);
        if (!agent) {
          return prompt;
        }

        const memories = await retrieveMemories(ctx.db, agent.id, prompt, MEMORY_LIMIT, {
          projectId: agent.threadProjectId,
          threadId,
        });
        const header = formatIdentityHeader(agent, memories, {
          soulMaxChars: SOUL_MAX_CHARS,
          identityMaxChars: IDENTITY_MAX_CHARS,
        });
        const anchor = formatIdentityAnchor(agent);

        return [header, prompt, anchor].join('\n\n---\n\n');
      },

      onAfterInvoke: async (threadId, result) => {
        const agent = await loadAgent(ctx.db, threadId);
        if (!agent) {
          return;
        }

        const config = await loadAgentConfig(ctx.db, agent.id);
        if (config?.memoryEnabled === false) {
          return;
        }

        // Fire-and-forget — do not block the pipeline
        void scoreAndWriteMemory(ctx, agent.id, agent.name, threadId, result.output, {
          reflectionEnabled: config?.reflectionEnabled ?? false,
          projectId: agent.threadProjectId,
        });
      },
    };
  },
};
