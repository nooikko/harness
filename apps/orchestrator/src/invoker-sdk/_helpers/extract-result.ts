// Extracts InvokeResult fields from an Agent SDK result message

import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import type { InvokeResult } from '@harness/plugin-contract';

type ExtractResult = (message: SDKResultMessage, durationMs: number) => InvokeResult;

export const extractResult: ExtractResult = (message, durationMs) => {
  const sessionId = message.session_id;
  const model = Object.keys(message.modelUsage)[0];
  const inputTokens = message.usage.input_tokens;
  const outputTokens = message.usage.output_tokens;

  if (message.subtype === 'success') {
    return {
      output: message.result,
      durationMs,
      exitCode: 0,
      sessionId,
      model,
      inputTokens,
      outputTokens,
    };
  }

  return {
    output: '',
    error: message.errors.join('; '),
    durationMs,
    exitCode: 1,
    sessionId,
    model,
    inputTokens,
    outputTokens,
  };
};
