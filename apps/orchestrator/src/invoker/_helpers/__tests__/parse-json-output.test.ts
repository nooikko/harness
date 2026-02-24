import { describe, expect, it } from 'vitest';
import { parseJsonOutput } from '../parse-json-output';

describe('parseJsonOutput', () => {
  it('parses a complete JSON response with all fields', () => {
    const json = JSON.stringify({
      result: 'Hello!',
      session_id: 'abc123',
      model: 'claude-haiku-4-5-20251001',
      usage: { input_tokens: 50, output_tokens: 10 },
    });

    const parsed = parseJsonOutput(json);

    expect(parsed.result).toBe('Hello!');
    expect(parsed.sessionId).toBe('abc123');
    expect(parsed.model).toBe('claude-haiku-4-5-20251001');
    expect(parsed.inputTokens).toBe(50);
    expect(parsed.outputTokens).toBe(10);
  });

  it('returns result with undefined metadata when fields are missing', () => {
    const json = JSON.stringify({ result: 'Hi' });

    const parsed = parseJsonOutput(json);

    expect(parsed.result).toBe('Hi');
    expect(parsed.sessionId).toBeUndefined();
    expect(parsed.model).toBeUndefined();
    expect(parsed.inputTokens).toBeUndefined();
    expect(parsed.outputTokens).toBeUndefined();
  });

  it('falls back to raw string when JSON parsing fails', () => {
    const parsed = parseJsonOutput('not valid json');

    expect(parsed.result).toBe('not valid json');
    expect(parsed.sessionId).toBeUndefined();
  });

  it('returns empty result for empty input', () => {
    const parsed = parseJsonOutput('');

    expect(parsed.result).toBe('');
  });

  it('returns empty result for whitespace-only input', () => {
    const parsed = parseJsonOutput('   \n  ');

    expect(parsed.result).toBe('');
  });

  it('trims whitespace from raw input before parsing', () => {
    const json = `  ${JSON.stringify({ result: 'trimmed', session_id: 's1' })}  `;

    const parsed = parseJsonOutput(json);

    expect(parsed.result).toBe('trimmed');
    expect(parsed.sessionId).toBe('s1');
  });

  it('uses raw trimmed string as result when result field is not a string', () => {
    const json = JSON.stringify({ result: 42, session_id: 'abc' });

    const parsed = parseJsonOutput(json);

    expect(parsed.result).toBe(json);
    expect(parsed.sessionId).toBe('abc');
  });

  it('ignores non-string session_id', () => {
    const json = JSON.stringify({ result: 'ok', session_id: 123 });

    const parsed = parseJsonOutput(json);

    expect(parsed.result).toBe('ok');
    expect(parsed.sessionId).toBeUndefined();
  });

  it('ignores non-number token counts in usage', () => {
    const json = JSON.stringify({
      result: 'ok',
      usage: { input_tokens: 'many', output_tokens: null },
    });

    const parsed = parseJsonOutput(json);

    expect(parsed.inputTokens).toBeUndefined();
    expect(parsed.outputTokens).toBeUndefined();
  });
});
