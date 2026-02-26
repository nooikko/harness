// Parse CLI usage — extracts token counts from Claude CLI output when available

export type CliTokenUsage = {
  inputTokens: number;
  outputTokens: number;
} | null;

/**
 * Regex patterns to extract token usage from Claude CLI output.
 * Claude CLI may include usage data in different formats depending on version.
 */
const INPUT_TOKEN_PATTERN = /input[_\s]?tokens[:\s]+(\d+)/i;
const OUTPUT_TOKEN_PATTERN = /output[_\s]?tokens[:\s]+(\d+)/i;

type ParseCliUsage = (output: string) => CliTokenUsage;

/**
 * Attempts to parse token usage information from Claude CLI output.
 * Returns null if no usage data is found, falling back to heuristic estimation.
 */
export const parseCliUsage: ParseCliUsage = (output) => {
  const inputMatch = INPUT_TOKEN_PATTERN.exec(output);
  const outputMatch = OUTPUT_TOKEN_PATTERN.exec(output);

  if (!inputMatch || !outputMatch) {
    return null;
  }

  const inputStr = inputMatch[1];
  const outputStr = outputMatch[1];

  if (!inputStr || !outputStr) {
    return null;
  }

  const inputTokens = Number.parseInt(inputStr, 10);
  const outputTokens = Number.parseInt(outputStr, 10);

  if (Number.isNaN(inputTokens) || Number.isNaN(outputTokens)) {
    return null;
  }

  return { inputTokens, outputTokens };
};
