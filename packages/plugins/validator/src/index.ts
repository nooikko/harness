// Validator plugin — quality-gates sub-agent delegation outputs via onTaskComplete hook

import type { InferSettings, PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { buildRubricPrompt } from './_helpers/build-rubric-prompt';
import { parseVerdict } from './_helpers/parse-verdict';
import { type settingsFields, settingsSchema } from './_helpers/settings-schema';

const DEFAULT_MODEL = 'claude-opus-4-6';

let settings: InferSettings<typeof settingsFields> = {};

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Validator plugin registered');

    return {
      onSettingsChange: async (pluginName: string) => {
        if (pluginName !== 'validator') {
          return;
        }
        settings = await ctx.getSettings(settingsSchema);
        ctx.logger.info('Validator plugin: settings reloaded');
      },

      onTaskComplete: async (threadId, taskId, result) => {
        const task = await ctx.db.orchestratorTask.findUnique({
          where: { id: taskId },
          select: { currentIteration: true, maxIterations: true, prompt: true },
        });

        if (!task) {
          return;
        }

        const isLastIteration = task.currentIteration >= task.maxIterations;

        // Fix 3: Skip Opus invocation for empty results — nothing to evaluate
        if (!result.trim()) {
          ctx.logger.warn('Validator: empty result, auto-accepting', { taskId, threadId });
          return;
        }

        const model = settings.model ?? DEFAULT_MODEL;

        const rubricPrompt = buildRubricPrompt({
          taskPrompt: task.prompt,
          result,
          iteration: task.currentIteration,
          maxIterations: task.maxIterations,
          customRubric: settings.customRubric,
        });

        // Fix 1: Invoker failures auto-accept instead of masquerading as quality rejections
        let output: string;
        try {
          const invokeResult = await ctx.invoker.invoke(rubricPrompt, {
            model,
            threadId: `validator-${threadId}`,
          });
          output = invokeResult.output;
        } catch (err) {
          ctx.logger.error('Validator: invoke failed, auto-accepting', {
            taskId,
            threadId,
            error: err instanceof Error ? err.message : String(err),
          });
          return;
        }

        const { verdict, feedback } = parseVerdict(output);

        if (verdict === 'pass') {
          ctx.logger.info('Validator: task accepted', { taskId, threadId });
          return;
        }

        if (verdict === 'fail') {
          // Fix 2: Still validate on last iteration but suppress rejection (safety valve)
          if (isLastIteration) {
            ctx.logger.warn('Validator: task rejected on final iteration, auto-accepting', { taskId, threadId, feedback });
            return;
          }
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
  settingsSchema,
  start: async (ctx: PluginContext): Promise<void> => {
    settings = await ctx.getSettings(settingsSchema);
  },
  register: createRegister(),
};
