import { describe, expect, it } from 'vitest';

const { parseTranscriptMessages, serializeTranscriptMessages } = await import('../parse-transcript-messages');

describe('parseTranscriptMessages', () => {
  it('parses simple Human/Assistant exchange', () => {
    const raw = 'Human: hello\n\nAssistant: hi there';
    const result = parseTranscriptMessages(raw);

    expect(result).toEqual([
      { index: 0, role: 'human', content: 'hello' },
      { index: 1, role: 'assistant', content: 'hi there' },
    ]);
  });

  it('handles multi-paragraph messages with single newlines', () => {
    const raw = 'Human: first line\nsecond line\nthird line\n\nAssistant: reply here';
    const result = parseTranscriptMessages(raw);

    expect(result).toEqual([
      {
        index: 0,
        role: 'human',
        content: 'first line\nsecond line\nthird line',
      },
      { index: 1, role: 'assistant', content: 'reply here' },
    ]);
  });

  it('returns empty array for empty string', () => {
    expect(parseTranscriptMessages('')).toEqual([]);
  });

  it('preserves message content exactly', () => {
    const content = '  some content with   extra   spaces  ';
    const raw = `Human: ${content}`;
    const result = parseTranscriptMessages(raw);

    expect(result[0]?.content).toBe(content);
  });

  it('assigns sequential indices starting from 0', () => {
    const raw = 'Human: one\n\nAssistant: two\n\nHuman: three\n\nAssistant: four';
    const result = parseTranscriptMessages(raw);

    expect(result.map((m) => m.index)).toEqual([0, 1, 2, 3]);
  });

  it('handles transcript starting with Assistant', () => {
    const raw = 'Assistant: I start first\n\nHuman: ok';
    const result = parseTranscriptMessages(raw);

    expect(result).toEqual([
      { index: 0, role: 'assistant', content: 'I start first' },
      { index: 1, role: 'human', content: 'ok' },
    ]);
  });
});

describe('serializeTranscriptMessages', () => {
  it('round-trips correctly with parseTranscriptMessages', () => {
    const original = 'Human: hello world\n\nAssistant: hi there\n\nHuman: thanks';
    const parsed = parseTranscriptMessages(original);
    const serialized = serializeTranscriptMessages(parsed);

    expect(serialized).toBe(original);
  });

  it('handles empty array', () => {
    expect(serializeTranscriptMessages([])).toBe('');
  });
});
