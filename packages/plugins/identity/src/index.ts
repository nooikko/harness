// Identity plugin — injects agent soul, identity, and memories into prompts
// Writes episodic memories based on conversation importance after each invocation

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { formatBootstrapPrompt } from './_helpers/format-bootstrap-prompt';
import { formatIdentityAnchor } from './_helpers/format-identity-anchor';
import { formatIdentityHeader } from './_helpers/format-identity-header';
import { loadAgent } from './_helpers/load-agent';
import { loadAgentConfig } from './_helpers/load-agent-config';
import type { RetrievalConfig } from './_helpers/retrieve-memories';
import { retrieveMemories } from './_helpers/retrieve-memories';
import { scoreAndWriteMemory } from './_helpers/score-and-write-memory';
import { settingsSchema } from './_helpers/settings-schema';
import { updateAgentSelf } from './_helpers/update-agent-self';

const SOUL_MAX_CHARS = 5000;
const IDENTITY_MAX_CHARS = 2000;
const DEFAULT_MEMORY_LIMIT = 10;

export const plugin: PluginDefinition = {
  name: 'identity',
  version: '1.0.0',
  settingsSchema,
  tools: [
    {
      name: 'update_self',
      description:
        'Update your own agent identity — name, personality, soul, role, goal, or backstory. Use this when the user wants to customize who you are.',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Your new display name' },
          soul: {
            type: 'string',
            description: 'Your core personality, values, and communication style (write in second person: "You are...")',
          },
          identity: { type: 'string', description: 'A concise one-sentence summary of who you are' },
          role: { type: 'string', description: 'Your primary role (e.g., "Creative Writing Partner")' },
          goal: { type: 'string', description: 'Your primary goal or purpose' },
          backstory: { type: 'string', description: 'Your background story or context' },
        },
      },
      handler: async (ctx, input, meta) => {
        return updateAgentSelf(ctx.db, meta.threadId, input as Record<string, string>);
      },
    },
  ],
  register: async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Identity plugin registered');

    let settings = await ctx.getSettings(settingsSchema);

    return {
      onSettingsChange: async (pluginName: string) => {
        if (pluginName !== 'identity') {
          return;
        }
        settings = await ctx.getSettings(settingsSchema);
        ctx.logger.info('Identity plugin: settings reloaded');
      },

      onBeforeInvoke: async (threadId, prompt) => {
        try {
          const agent = await loadAgent(ctx.db, threadId);
          if (!agent) {
            return prompt;
          }

          const config = await loadAgentConfig(ctx.db, agent.id);

          const memoryLimit = settings.memoryLimit ?? DEFAULT_MEMORY_LIMIT;
          const retrievalConfig: RetrievalConfig = {
            candidatePool: settings.candidatePool,
            decayRate: settings.decayRate,
            reflectionBoost: settings.reflectionBoost,
            semanticBoost: settings.semanticBoost,
          };

          const memories = await retrieveMemories(
            ctx.db,
            agent.id,
            prompt,
            memoryLimit,
            {
              projectId: agent.threadProjectId,
              threadId,
            },
            retrievalConfig,
          );
          const header = formatIdentityHeader(agent, memories, {
            soulMaxChars: SOUL_MAX_CHARS,
            identityMaxChars: IDENTITY_MAX_CHARS,
          });
          const anchor = formatIdentityAnchor(agent);

          // Inject bootstrap prompt if agent hasn't been bootstrapped yet
          const sections: string[] = [];
          if (config?.bootstrapped === false) {
            sections.push(formatBootstrapPrompt(agent.name));
          }
          sections.push(header);
          sections.push(prompt);
          sections.push(anchor);

          return sections.join('\n\n---\n\n');
        } catch (err) {
          ctx.logger.error(
            `identity: onBeforeInvoke failed, prompt passed through without identity [thread=${threadId}]: ${err instanceof Error ? err.message : String(err)}`,
          );
          return prompt;
        }
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

        // Fire-and-forget — do not block the pipeline.
        // .catch() ensures unhandled rejections include agent/thread context for debugging.
        void scoreAndWriteMemory(ctx, agent.id, agent.name, threadId, result.output, {
          reflectionEnabled: config?.reflectionEnabled ?? false,
          projectId: agent.threadProjectId,
          importanceThreshold: settings.importanceThreshold,
          reflectionThreshold: settings.reflectionThreshold,
        }).catch((err) => {
          const error = err instanceof Error ? err : new Error(String(err));
          ctx.reportBackgroundError('score-and-write-memory', error);
        });
      },
    };
  },
};
