import { describe, expect, it } from 'vitest';
import { buildRecapPrompt } from '../build-recap-prompt';

describe('buildRecapPrompt', () => {
  it('includes story premise when provided', () => {
    const result = buildRecapPrompt({
      characters: [],
      moments: [],
      recentMessages: [],
      premise: 'A tale of two kingdoms at war.',
    });

    expect(result).toContain('A tale of two kingdoms at war.');
    expect(result).toContain('## Story Premise');
  });

  it('includes character names and status', () => {
    const result = buildRecapPrompt({
      characters: [
        { name: 'Elena', personality: 'brave and cunning', appearance: 'red hair', status: 'active' },
        { name: 'Sir Aldric', personality: null, appearance: null, status: 'active' },
      ],
      moments: [],
      recentMessages: [],
      premise: null,
    });

    expect(result).toContain('**Elena** (active)');
    expect(result).toContain('brave and cunning');
    expect(result).toContain('red hair');
    expect(result).toContain('**Sir Aldric** (active)');
    expect(result).toContain('## Current Cast');
  });

  it('includes moments with story time and character names', () => {
    const result = buildRecapPrompt({
      characters: [],
      moments: [
        {
          summary: 'The knight confronted the dragon',
          storyTime: 'Dawn',
          characterNames: ['Sir Aldric', 'The Dragon'],
        },
      ],
      recentMessages: [],
      premise: null,
    });

    expect(result).toContain('The knight confronted the dragon');
    expect(result).toContain('[Dawn]');
    expect(result).toContain('Sir Aldric, The Dragon');
    expect(result).toContain('## Key Events So Far');
  });

  it('includes recent messages with roles', () => {
    const result = buildRecapPrompt({
      characters: [],
      moments: [],
      recentMessages: [
        { role: 'user', content: 'She draws her sword.' },
        { role: 'assistant', content: 'The blade gleams in the moonlight.' },
      ],
      premise: null,
    });

    expect(result).toContain('**user:** She draws her sword.');
    expect(result).toContain('**assistant:** The blade gleams in the moonlight.');
    expect(result).toContain('## Where We Left Off');
  });

  it('handles empty story context gracefully', () => {
    const result = buildRecapPrompt({
      characters: [],
      moments: [],
      recentMessages: [],
      premise: null,
    });

    expect(result).toContain('No story context available yet.');
    expect(result).toContain('# Story Recap');
  });

  it('omits null personality and appearance from character lines', () => {
    const result = buildRecapPrompt({
      characters: [{ name: 'The Guard', personality: null, appearance: null, status: 'active' }],
      moments: [],
      recentMessages: [],
      premise: null,
    });

    expect(result).toContain('**The Guard** (active)');
    expect(result).not.toContain('Personality:');
    expect(result).not.toContain('Appearance:');
  });

  it('includes continuation instruction at the end', () => {
    const result = buildRecapPrompt({
      characters: [],
      moments: [],
      recentMessages: [],
      premise: null,
    });

    expect(result).toContain('Continue the story from where we left off');
  });

  it('handles moments without story time', () => {
    const result = buildRecapPrompt({
      characters: [],
      moments: [{ summary: 'They arrived at the castle', storyTime: null, characterNames: [] }],
      recentMessages: [],
      premise: null,
    });

    expect(result).toContain('- They arrived at the castle');
    expect(result).not.toContain('[');
  });
});
