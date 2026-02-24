import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { extractResult } from '../extract-result';

const baseUsage = {
  input_tokens: 100,
  output_tokens: 50,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  server_tool_use: undefined,
};

const baseModelUsage = {
  'claude-haiku-4-5-20251001': {
    inputTokens: 100,
    outputTokens: 50,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    webSearchRequests: 0,
    costUSD: 0.01,
    contextWindow: 200000,
    maxOutputTokens: 8192,
  },
};

const successResult: SDKResultMessage = {
  type: 'result',
  subtype: 'success',
  duration_ms: 5000,
  duration_api_ms: 4000,
  is_error: false,
  num_turns: 1,
  result: 'Hello, world!',
  stop_reason: 'end_turn',
  total_cost_usd: 0.01,
  usage: baseUsage,
  modelUsage: baseModelUsage,
  permission_denials: [],
  uuid: '00000000-0000-0000-0000-000000000001' as `${string}-${string}-${string}-${string}-${string}`,
  session_id: 'sess-abc123',
};

const errorResult: SDKResultMessage = {
  type: 'result',
  subtype: 'error_during_execution',
  duration_ms: 2000,
  duration_api_ms: 1500,
  is_error: true,
  num_turns: 1,
  stop_reason: null,
  total_cost_usd: 0.005,
  usage: baseUsage,
  modelUsage: baseModelUsage,
  permission_denials: [],
  errors: ['Something went wrong', 'Another error'],
  uuid: '00000000-0000-0000-0000-000000000002' as `${string}-${string}-${string}-${string}-${string}`,
  session_id: 'sess-def456',
};

describe('extractResult', () => {
  it('extracts output from a success result', () => {
    const result = extractResult(successResult, 6000);

    expect(result.output).toBe('Hello, world!');
    expect(result.exitCode).toBe(0);
    expect(result.error).toBeUndefined();
  });

  it('uses the provided durationMs instead of the SDK duration', () => {
    const result = extractResult(successResult, 7500);

    expect(result.durationMs).toBe(7500);
  });

  it('extracts session_id from the result', () => {
    const result = extractResult(successResult, 5000);

    expect(result.sessionId).toBe('sess-abc123');
  });

  it('extracts model name from the first key of modelUsage', () => {
    const result = extractResult(successResult, 5000);

    expect(result.model).toBe('claude-haiku-4-5-20251001');
  });

  it('extracts token counts from usage', () => {
    const result = extractResult(successResult, 5000);

    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
  });

  it('returns empty output and joined errors for error result', () => {
    const result = extractResult(errorResult, 3000);

    expect(result.output).toBe('');
    expect(result.error).toBe('Something went wrong; Another error');
    expect(result.exitCode).toBe(1);
  });

  it('extracts session_id from error result', () => {
    const result = extractResult(errorResult, 3000);

    expect(result.sessionId).toBe('sess-def456');
  });

  it('returns undefined model when modelUsage is empty', () => {
    const emptyModelResult: SDKResultMessage = {
      ...successResult,
      modelUsage: {},
    };

    const result = extractResult(emptyModelResult, 5000);

    expect(result.model).toBeUndefined();
  });

  it('handles error_max_turns subtype as an error', () => {
    const maxTurnsResult: SDKResultMessage = {
      ...errorResult,
      subtype: 'error_max_turns',
      errors: ['Max turns reached'],
    };

    const result = extractResult(maxTurnsResult, 4000);

    expect(result.output).toBe('');
    expect(result.error).toBe('Max turns reached');
    expect(result.exitCode).toBe(1);
  });
});
