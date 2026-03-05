// Format cost — converts numeric cost values to human-readable USD strings

type FormatCost = (cost: number) => string;

/**
 * Formats a cost value in USD with appropriate precision.
 * Uses 4 decimal places for small values and 2 for larger values.
 */
export const formatCost: FormatCost = (cost) => {
  if (cost === 0) {
    return '$0.00';
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
};

type FormatTokenCount = (count: number) => string;

/**
 * Formats a token count with thousands separators for readability.
 */
export const formatTokenCount: FormatTokenCount = (count) => {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
};
