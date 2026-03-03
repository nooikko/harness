// Model pricing resolution — maps model identifiers to per-million-token rates.
// Shared across all plugins that need cost calculation (metrics, delegation).

/**
 * Model pricing in USD per million tokens.
 * Rates as of 2025 Claude model pricing.
 */
export type ModelPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
};

const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-20250514': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-opus-4-20250514': { inputPerMillion: 15, outputPerMillion: 75 },
  'claude-haiku-3.5-20241022': {
    inputPerMillion: 0.8,
    outputPerMillion: 4,
  },
  // Short aliases used by the orchestrator config
  sonnet: { inputPerMillion: 3, outputPerMillion: 15 },
  opus: { inputPerMillion: 15, outputPerMillion: 75 },
  haiku: { inputPerMillion: 0.8, outputPerMillion: 4 },
};

/**
 * Default pricing used when a model is not found in the pricing table.
 * Uses Sonnet pricing as a reasonable middle ground.
 */
const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 3,
  outputPerMillion: 15,
};

type GetModelPricing = (model: string) => ModelPricing;

/**
 * Resolves pricing for a model string.
 * Tries exact match first, then checks if the model string contains a known key.
 * Falls back to default (Sonnet) pricing.
 */
export const getModelPricing: GetModelPricing = (model) => {
  const normalized = model.toLowerCase();

  // Exact match
  const exact = MODEL_PRICING[normalized];
  if (exact) {
    return exact;
  }

  // Partial match — check if model string contains a known model name
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (normalized.includes(key)) {
      return pricing;
    }
  }

  return DEFAULT_PRICING;
};

type GetModelCost = (model: string, inputTokens: number, outputTokens: number) => number;

/**
 * Computes estimated cost in USD from model name and token counts.
 */
export const getModelCost: GetModelCost = (model, inputTokens, outputTokens) => {
  const pricing = getModelPricing(model);
  return (inputTokens / 1_000_000) * pricing.inputPerMillion + (outputTokens / 1_000_000) * pricing.outputPerMillion;
};
