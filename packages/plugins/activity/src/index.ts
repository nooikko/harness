import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { persistPipelineComplete } from './_helpers/persist-pipeline-complete';
import { persistPipelineStart } from './_helpers/persist-pipeline-start';
import { persistPipelineSteps } from './_helpers/persist-pipeline-steps';
import { persistStreamEvents } from './_helpers/persist-stream-events';

type CreateRegister = () => (ctx: PluginContext) => Promise<PluginHooks>;

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Activity plugin registered');

    return {
      onPipelineStart: async (threadId) => {
        try {
          await persistPipelineStart(ctx.db, threadId);
        } catch (err) {
          ctx.logger.error(`Activity: failed to persist pipeline_start: ${err instanceof Error ? err.message : String(err)}`);
        }
      },

      onPipelineComplete: async (threadId, { invokeResult, pipelineSteps, streamEvents }) => {
        try {
          await persistPipelineSteps(ctx.db, threadId, pipelineSteps);
          await persistStreamEvents(ctx.db, threadId, streamEvents);
          await persistPipelineComplete(ctx.db, threadId, invokeResult);
        } catch (err) {
          ctx.logger.error(`Activity: failed to persist pipeline complete: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    };
  };

  return register;
};

export const plugin: PluginDefinition = {
  name: 'activity',
  version: '1.0.0',
  register: createRegister(),
};
