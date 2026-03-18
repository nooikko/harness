import { describe, expect, it } from 'vitest';
import { formatCharacterFull } from '../format-character-full';

describe('formatCharacterFull', () => {
  const fullCharacter = {
    name: 'Sam',
    appearance: 'Tall, lean, sharp jawline',
    personality: 'Guarded, walls up for years',
    mannerisms: 'Pauses before answering',
    motives: 'Wants connection but fears vulnerability',
    backstory: 'Left home at 17',
    relationships: 'Growing intimate with Elena',
    moments: [
      {
        storyTime: 'Nov 13',
        locationName: "Rebecca's kitchen",
        summary: 'Had her first kiss with Elena.',
        perspective: "Terrified but couldn't stop herself.",
        emotionalImpact: 'Realized intimacy can feel safe.',
        knowledgeGained: 'Elena feels the same way',
      },
    ],
  };

  const fullKnowledge = {
    knows: ['Elena feels the same way', "Rebecca's history"],
    doesNotKnow: ['Marcus is back in town'],
  };

  it('renders all fields when present', () => {
    const result = formatCharacterFull(fullCharacter, fullKnowledge);

    expect(result).toContain('### Sam');
    expect(result).toContain('Appearance: Tall, lean, sharp jawline');
    expect(result).toContain('Personality: Guarded, walls up for years');
    expect(result).toContain('Mannerisms: Pauses before answering');
    expect(result).toContain('Motives: Wants connection but fears vulnerability');
    expect(result).toContain('Backstory: Left home at 17');
    expect(result).toContain('Relationships: Growing intimate with Elena');
  });

  it('renders moments with time, location, perspective, and impact', () => {
    const result = formatCharacterFull(fullCharacter, fullKnowledge);

    expect(result).toContain("Key moments (Sam's perspective):");
    expect(result).toContain("Nov 13 @ Rebecca's kitchen: Had her first kiss with Elena.");
    expect(result).toContain('"Terrified but couldn\'t stop herself."');
    expect(result).toContain('Impact: Realized intimacy can feel safe.');
  });

  it('renders knowledge sections', () => {
    const result = formatCharacterFull(fullCharacter, fullKnowledge);

    expect(result).toContain("Knows: Elena feels the same way, Rebecca's history");
    expect(result).toContain('Does NOT know: Marcus is back in town');
  });

  it('skips null/undefined/empty fields', () => {
    const sparseCharacter = {
      name: 'Ghost',
      appearance: null,
      personality: 'Mysterious',
      mannerisms: undefined,
      motives: null,
      backstory: null,
      relationships: null,
      moments: [],
    };

    const result = formatCharacterFull(sparseCharacter, { knows: [], doesNotKnow: [] });

    expect(result).toContain('### Ghost');
    expect(result).toContain('Personality: Mysterious');
    expect(result).not.toContain('Appearance:');
    expect(result).not.toContain('Mannerisms:');
    expect(result).not.toContain('Motives:');
    expect(result).not.toContain('Backstory:');
    expect(result).not.toContain('Relationships:');
    expect(result).not.toContain('Key moments');
    expect(result).not.toContain('Knows:');
    expect(result).not.toContain('Does NOT know:');
  });

  it('limits moments to top 5', () => {
    const manyMoments = Array.from({ length: 8 }, (_, i) => ({
      storyTime: null,
      locationName: null,
      summary: `Moment ${i + 1}`,
      perspective: null,
      emotionalImpact: null,
      knowledgeGained: null,
    }));

    const character = { name: 'Busy', moments: manyMoments };
    const result = formatCharacterFull(character, { knows: [], doesNotKnow: [] });

    expect(result).toContain('Moment 1');
    expect(result).toContain('Moment 5');
    expect(result).not.toContain('Moment 6');
    expect(result).not.toContain('Moment 8');
  });

  it('handles moments without time or location', () => {
    const character = {
      name: 'Quiet',
      moments: [
        {
          storyTime: null,
          locationName: null,
          summary: 'Realized the truth.',
          perspective: null,
          emotionalImpact: null,
          knowledgeGained: null,
        },
      ],
    };

    const result = formatCharacterFull(character, { knows: [], doesNotKnow: [] });

    expect(result).toContain('  - Realized the truth.');
    expect(result).not.toContain('@');
  });

  it('handles moment with only location (no time)', () => {
    const character = {
      name: 'Local',
      moments: [
        {
          storyTime: null,
          locationName: 'The Park',
          summary: 'Found the letter.',
          perspective: null,
          emotionalImpact: null,
          knowledgeGained: null,
        },
      ],
    };

    const result = formatCharacterFull(character, { knows: [], doesNotKnow: [] });

    expect(result).toContain('@ The Park: Found the letter.');
  });
});
