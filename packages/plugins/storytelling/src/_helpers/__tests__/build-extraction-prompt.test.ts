import { describe, expect, it } from 'vitest';
import { buildExtractionPrompt } from '../build-extraction-prompt';

describe('buildExtractionPrompt', () => {
  it('includes character names and IDs in the prompt', () => {
    const result = buildExtractionPrompt({
      characters: [
        { id: 'char-1', name: 'Sir Aldric' },
        { id: 'char-2', name: 'Elena' },
      ],
      locations: [],
      storyTime: null,
      latestExchange: 'Hello',
    });

    expect(result).toContain('Sir Aldric (id: char-1)');
    expect(result).toContain('Elena (id: char-2)');
  });

  it('includes location names, IDs, and parent names in the prompt', () => {
    const result = buildExtractionPrompt({
      characters: [],
      locations: [
        { id: 'loc-1', name: 'The Castle', parentName: 'Kingdom of Ardan' },
        { id: 'loc-2', name: 'Kingdom of Ardan' },
      ],
      storyTime: null,
      latestExchange: 'Hello',
    });

    expect(result).toContain('The Castle (inside: Kingdom of Ardan) (id: loc-1)');
    expect(result).toContain('Kingdom of Ardan (id: loc-2)');
  });

  it('includes the latest exchange in the prompt', () => {
    const exchange = '[User]: The knight drew his sword.\n\n[Assistant]: Sir Aldric raised his blade.';
    const result = buildExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: null,
      latestExchange: exchange,
    });

    expect(result).toContain('The knight drew his sword.');
    expect(result).toContain('Sir Aldric raised his blade.');
  });

  it('includes story time when provided', () => {
    const result = buildExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: 'Dawn of the third day',
      latestExchange: 'Hello',
    });

    expect(result).toContain('Current story time: Dawn of the third day');
  });

  it("shows 'not established yet' when story time is null", () => {
    const result = buildExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: null,
      latestExchange: 'Hello',
    });

    expect(result).toContain('Story time: not established yet');
  });

  it("shows '(none yet)' when no characters exist", () => {
    const result = buildExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: null,
      latestExchange: 'Hello',
    });

    expect(result).toContain('(none yet)');
  });

  it('requests JSON output with the expected structure', () => {
    const result = buildExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: null,
      latestExchange: 'Hello',
    });

    expect(result).toContain('"characters"');
    expect(result).toContain('"moments"');
    expect(result).toContain('"locations"');
    expect(result).toContain('"scene"');
    expect(result).toContain('"aliases"');
  });
});
