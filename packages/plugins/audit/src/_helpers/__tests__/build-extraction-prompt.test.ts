// Tests for build-extraction-prompt helper

import { describe, expect, it } from 'vitest';
import { buildExtractionPrompt } from '../build-extraction-prompt';

describe('buildExtractionPrompt', () => {
  it('includes message content in the prompt', () => {
    const messages = [
      { role: 'user', content: 'What is the capital of France?' },
      { role: 'assistant', content: 'The capital of France is Paris.' },
    ];

    const prompt = buildExtractionPrompt(messages);

    expect(prompt).toContain('What is the capital of France?');
    expect(prompt).toContain('The capital of France is Paris.');
  });

  it('formats roles in uppercase', () => {
    const messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];

    const prompt = buildExtractionPrompt(messages);

    expect(prompt).toContain('[USER]: hello');
    expect(prompt).toContain('[ASSISTANT]: hi');
  });

  it('wraps transcript in section markers', () => {
    const messages = [{ role: 'user', content: 'test' }];
    const prompt = buildExtractionPrompt(messages);

    expect(prompt).toContain('--- CONVERSATION TRANSCRIPT ---');
    expect(prompt).toContain('--- END TRANSCRIPT ---');
  });

  it('handles multiple messages in order', () => {
    const messages = [
      { role: 'user', content: 'first message' },
      { role: 'assistant', content: 'second message' },
      { role: 'user', content: 'third message' },
    ];

    const prompt = buildExtractionPrompt(messages);
    const firstIdx = prompt.indexOf('first message');
    const secondIdx = prompt.indexOf('second message');
    const thirdIdx = prompt.indexOf('third message');

    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });

  it('produces valid prompt with empty messages', () => {
    const prompt = buildExtractionPrompt([]);

    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('--- CONVERSATION TRANSCRIPT ---');
    expect(prompt).toContain('--- END TRANSCRIPT ---');
  });
});
