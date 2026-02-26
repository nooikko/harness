// Metrics plugin — tracks token usage and cost via onAfterInvoke hook

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { calculateCost } from './_helpers/calculate-cost';
import { recordUsageMetrics } from './_helpers/record-usage-metrics';

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Metrics plugin registered');

    return {
      onAfterInvoke: async (threadId, result) => {
        const { model, inputTokens, outputTokens } = result;

        if (!model || inputTokens == null || outputTokens == null) {
          return;
        }

        try {
          const { totalCost } = calculateCost(model, inputTokens, outputTokens);

          await recordUsageMetrics(ctx.db, {
            threadId,
            model,
            inputTokens,
            outputTokens,
            costEstimate: totalCost,
          });
        } catch (err) {
          ctx.logger.error(`Metrics: failed to record usage: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    };
  };

  return register;
};

export const plugin: PluginDefinition = {
  name: 'metrics',
  version: '1.0.0',
  register: createRegister(),
};
