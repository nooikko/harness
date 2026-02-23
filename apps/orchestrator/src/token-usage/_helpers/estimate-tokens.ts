// Token estimation — heuristic approximation of token counts from text content

export type TokenEstimate = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

/**
 * Average characters per token for English text.
 * Claude tokenizers average ~3.5-4 chars per token for English.
 * We use 4 as a conservative estimate.
 */
const CHARS_PER_TOKEN = 4;

type EstimateTokensFromText = (text: string) => number;

/**
 * Estimates the number of tokens in a text string using a character-based heuristic.
 * Returns at least 1 token for non-empty strings.
 */
export const estimateTokensFromText: EstimateTokensFromText = (text) => {
  if (!text || text.length === 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
};

type EstimateTokens = (input: string, output: string) => TokenEstimate;

/**
 * Estimates input and output token counts from prompt and response text.
 */
export const estimateTokens: EstimateTokens = (input, output) => {
  const inputTokens = estimateTokensFromText(input);
  const outputTokens = estimateTokensFromText(output);
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
};
