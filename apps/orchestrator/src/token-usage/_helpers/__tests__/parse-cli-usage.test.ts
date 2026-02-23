import { describe, expect, it } from 'vitest';
import { parseCliUsage } from '../parse-cli-usage';

describe('parseCliUsage', () => {
  it('returns null when no token data is present', () => {
    const result = parseCliUsage('Hello, this is a normal response.');
    expect(result).toBeNull();
  });

  it('parses input_tokens and output_tokens from CLI output', () => {
    const output = 'Some response text\ninput_tokens: 1500\noutput_tokens: 800\n';
    const result = parseCliUsage(output);
    expect(result).toEqual({ inputTokens: 1500, outputTokens: 800 });
  });

  it('parses tokens with different formatting (spaces)', () => {
    const output = 'input tokens: 2000\noutput tokens: 1000';
    const result = parseCliUsage(output);
    expect(result).toEqual({ inputTokens: 2000, outputTokens: 1000 });
  });

  it('returns null when only input tokens are present', () => {
    const output = 'input_tokens: 1500\nno output data here';
    const result = parseCliUsage(output);
    expect(result).toBeNull();
  });

  it('returns null when only output tokens are present', () => {
    const output = 'no input data here\noutput_tokens: 800';
    const result = parseCliUsage(output);
    expect(result).toBeNull();
  });

  it('handles case-insensitive matching', () => {
    const output = 'Input_Tokens: 500\nOutput_Tokens: 300';
    const result = parseCliUsage(output);
    expect(result).toEqual({ inputTokens: 500, outputTokens: 300 });
  });

  it('returns null for empty string', () => {
    expect(parseCliUsage('')).toBeNull();
  });
});
