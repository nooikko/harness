import { describe, expect, it } from 'vitest';
import { chunkTranscript, parseClaudeTranscript } from '../chunk-transcript';

describe('parseClaudeTranscript', () => {
  it('parses Human/Assistant alternating messages', () => {
    const raw = `Human: Hello there
Assistant: Hi! How can I help?
Human: Tell me a story
Assistant: Once upon a time...`;

    const messages = parseClaudeTranscript(raw);

    expect(messages).toHaveLength(4);
    expect(messages[0]).toEqual({ role: 'human', content: 'Hello there', index: 0 });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi! How can I help?', index: 1 });
    expect(messages[2]).toEqual({ role: 'human', content: 'Tell me a story', index: 2 });
    expect(messages[3]).toEqual({ role: 'assistant', content: 'Once upon a time...', index: 3 });
  });

  it('handles multi-line messages', () => {
    const raw = `Human: First line
Second line
Third line
Assistant: Response here`;

    const messages = parseClaudeTranscript(raw);

    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toBe('First line\nSecond line\nThird line');
  });

  it('handles User: prefix variant', () => {
    const raw = `User: Hello
Assistant: Hi`;

    const messages = parseClaudeTranscript(raw);

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('human');
  });

  it('returns empty array for unparseable input', () => {
    const raw = 'Just some random text with no role markers';

    const messages = parseClaudeTranscript(raw);

    expect(messages).toHaveLength(0);
  });
});

describe('chunkTranscript', () => {
  const makeTranscript = (pairCount: number) => {
    const lines: string[] = [];
    for (let i = 0; i < pairCount; i++) {
      lines.push(`Human: Message ${i + 1}`);
      lines.push(`Assistant: Response ${i + 1}`);
    }
    return lines.join('\n');
  };

  it('returns all messages in a single chunk for small transcripts', () => {
    const raw = makeTranscript(5);
    const result = chunkTranscript(raw, { pairsPerChunk: 12 });

    expect(result.chunks).toHaveLength(1);
    expect(result.messages).toHaveLength(10);
    expect(result.chunks[0]).toHaveLength(10);
  });

  it('splits large transcripts into chunks with overlap', () => {
    const raw = makeTranscript(30);
    const result = chunkTranscript(raw, { pairsPerChunk: 12, overlapPairs: 2 });

    expect(result.messages).toHaveLength(60);
    expect(result.chunks.length).toBeGreaterThan(1);

    // Each chunk should have at most 24 messages (12 pairs)
    for (const chunk of result.chunks) {
      expect(chunk.length).toBeLessThanOrEqual(24);
    }
  });

  it('covers all messages across chunks', () => {
    const raw = makeTranscript(25);
    const result = chunkTranscript(raw, { pairsPerChunk: 10, overlapPairs: 2 });

    // All original messages should appear in at least one chunk
    const allChunkedIndices = new Set(result.chunks.flat().map((m) => m.index));
    for (const msg of result.messages) {
      expect(allChunkedIndices.has(msg.index)).toBe(true);
    }
  });
});
