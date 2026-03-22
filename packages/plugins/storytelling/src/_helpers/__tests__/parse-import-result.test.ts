import { describe, expect, it } from 'vitest';
import { parseImportCharacterResult, parseImportExtractionResult } from '../parse-import-result';

describe('parseImportExtractionResult', () => {
  it('parses a valid extraction result with all fields', () => {
    const raw = JSON.stringify({
      characters: [{ action: 'create', name: 'Violet', fields: { personality: 'Guarded but kind' } }],
      moments: [
        {
          summary: 'Violet joined the team',
          kind: 'bonding',
          importance: 8,
          driftFlag: false,
          characters: [{ name: 'Violet', role: 'protagonist' }],
        },
      ],
      locations: [{ action: 'create', name: 'The Gym' }],
      scene: { characters: ['Violet'], location: 'The Gym', storyTime: 'Day 1' },
      aliases: [{ alias: 'Vi', resolvedName: 'Violet' }],
    });

    const result = parseImportExtractionResult(raw);

    expect(result).not.toBeNull();
    expect(result?.characters).toHaveLength(1);
    expect(result?.moments).toHaveLength(1);
    expect(result?.moments[0]?.driftFlag).toBe(false);
    expect(result?.locations).toHaveLength(1);
    expect(result?.aliases).toHaveLength(1);
  });

  it('handles drift flags on moments', () => {
    const raw = JSON.stringify({
      characters: [],
      moments: [
        {
          summary: 'Driver realizes his role',
          kind: 'revelation',
          importance: 9,
          driftFlag: true,
          driftNote: 'Similar to Day 8 driver lunch scene',
          characters: [{ name: 'Marcus', role: 'protagonist' }],
        },
      ],
      locations: [],
      scene: null,
      aliases: [],
    });

    const result = parseImportExtractionResult(raw);

    expect(result?.moments[0]?.driftFlag).toBe(true);
    expect(result?.moments[0]?.driftNote).toBe('Similar to Day 8 driver lunch scene');
  });

  it('handles relationshipContext on characters in moments', () => {
    const raw = JSON.stringify({
      characters: [],
      moments: [
        {
          summary: 'Kai comforts Violet',
          kind: 'intimate',
          importance: 9,
          characters: [
            {
              name: 'Kai',
              role: 'comforter',
              relationshipContext: 'First time showing physical affection',
            },
          ],
        },
      ],
      locations: [],
      scene: null,
      aliases: [],
    });

    const result = parseImportExtractionResult(raw);

    expect(result?.moments[0]?.characters[0]?.relationshipContext).toBe('First time showing physical affection');
  });

  it('returns null for invalid JSON', () => {
    expect(parseImportExtractionResult('not json')).toBeNull();
  });

  it('returns null for missing required fields', () => {
    const raw = JSON.stringify({ moments: [{ kind: 'action' }] });
    expect(parseImportExtractionResult(raw)).toBeNull();
  });

  it('defaults missing arrays to empty', () => {
    const raw = JSON.stringify({});
    const result = parseImportExtractionResult(raw);

    expect(result?.characters).toEqual([]);
    expect(result?.moments).toEqual([]);
    expect(result?.locations).toEqual([]);
    expect(result?.aliases).toEqual([]);
  });

  it('extracts JSON from surrounding text', () => {
    const raw = `Here is the extraction:\n${JSON.stringify({ characters: [], moments: [], locations: [], scene: null, aliases: [] })}\nDone.`;
    const result = parseImportExtractionResult(raw);

    expect(result).not.toBeNull();
  });
});

describe('parseImportCharacterResult', () => {
  it('parses valid character import result', () => {
    const raw = JSON.stringify({
      characters: [
        {
          action: 'create',
          name: 'Violet',
          aliases: ['Vi'],
          fields: { personality: 'Guarded but kind', appearance: 'Tall with dark hair' },
        },
      ],
    });

    const result = parseImportCharacterResult(raw);

    expect(result).not.toBeNull();
    expect(result?.characters).toHaveLength(1);
    expect(result?.characters[0]?.aliases).toEqual(['Vi']);
  });

  it('returns null for invalid input', () => {
    expect(parseImportCharacterResult('garbage')).toBeNull();
  });
});
