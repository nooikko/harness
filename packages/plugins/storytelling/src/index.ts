import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { detectOocMessage } from './_helpers/detect-ooc-message';
import { formatStorytellingInstructions } from './_helpers/format-storytelling-instructions';
import { wrapOocContent } from './_helpers/wrap-ooc-content';

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Storytelling plugin registered');

    return {
      onBeforeInvoke: async (threadId, prompt) => {
        const thread = await ctx.db.thread.findUnique({
          where: { id: threadId },
          select: { kind: true },
        });

        if (thread?.kind !== 'storytelling') {
          return prompt;
        }

        const latestUserMessage = await ctx.db.message.findFirst({
          where: { threadId, role: 'user' },
          orderBy: { createdAt: 'desc' },
          select: { content: true },
        });

        let modifiedPrompt = prompt;

        if (latestUserMessage?.content) {
          const oocResult = detectOocMessage(latestUserMessage.content);
          if (oocResult.isOoc) {
            const wrapped = wrapOocContent(oocResult.content);
            modifiedPrompt = `${modifiedPrompt}\n\n${wrapped}`;
          }
        }

        const instructions = formatStorytellingInstructions();
        modifiedPrompt = `${modifiedPrompt}\n\n${instructions}`;

        return modifiedPrompt;
      },
    };
  };

  return register;
};

export const plugin: PluginDefinition = {
  name: 'storytelling',
  version: '1.0.0',
  register: createRegister(),
};
