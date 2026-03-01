// Validator plugin — quality-gates sub-agent delegation outputs via onTaskComplete hook

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { buildRubricPrompt } from './_helpers/build-rubric-prompt';
import { parseVerdict } from './_helpers/parse-verdict';

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Validator plugin registered');

    return {
      onTaskComplete: async (threadId, taskId, result) => {
        const task = await ctx.db.orchestratorTask.findUnique({
          where: { id: taskId },
          select: { currentIteration: true, maxIterations: true, prompt: true },
        });

        // Safety valve: never block the last iteration (prevents infinite loops)
        if (!task || task.currentIteration >= task.maxIterations) {
          return;
        }

        const rubricPrompt = buildRubricPrompt({
          taskPrompt: task.prompt,
          result,
          iteration: task.currentIteration,
          maxIterations: task.maxIterations,
        });

        const invokeResult = await ctx.invoker.invoke(rubricPrompt, {
          model: 'claude-opus-4-6',
          threadId,
        });

        const { verdict, feedback } = parseVerdict(invokeResult.output);

        if (verdict === 'pass') {
          ctx.logger.info('Validator: task accepted', { taskId, threadId });
          return;
        }

        if (verdict === 'fail') {
          ctx.logger.warn('Validator: task rejected', { taskId, threadId, feedback });
          throw new Error(feedback);
        }

        // Unknown verdict — log warning, accept to avoid blocking
        ctx.logger.warn('Validator: could not parse verdict, auto-accepting', { taskId, threadId });
      },
    };
  };

  return register;
};

export const plugin: PluginDefinition = {
  name: 'validator',
  version: '1.0.0',
  register: createRegister(),
};
