// Cost calculation — computes estimated cost from token counts and model pricing

import { getModelPricing } from '@harness/plugin-contract';

export type CostBreakdown = {
  inputCost: number;
  outputCost: number;
  totalCost: number;
};

type CalculateCost = (model: string, inputTokens: number, outputTokens: number) => CostBreakdown;

/**
 * Calculates the estimated cost in USD for a given model and token counts.
 * Returns a breakdown of input cost, output cost, and total cost.
 */
export const calculateCost: CalculateCost = (model, inputTokens, outputTokens) => {
  const pricing = getModelPricing(model);
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
};
