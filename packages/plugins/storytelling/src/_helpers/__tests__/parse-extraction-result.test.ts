import { describe, expect, it } from 'vitest';
import { parseExtractionResult } from '../parse-extraction-result';

const VALID_RESULT = {
  characters: [{ action: 'create', name: 'Sir Aldric', fields: { appearance: 'tall knight' } }],
  moments: [
    {
      summary: 'The knight arrived at the castle',
      kind: 'action',
      importance: 7,
      characters: [{ name: 'Sir Aldric', role: 'protagonist' }],
    },
  ],
  locations: [{ action: 'create', name: 'The Castle', description: 'A dark fortress' }],
  scene: { characters: ['Sir Aldric'], location: 'The Castle', storyTime: 'Dawn' },
  aliases: [{ alias: 'the knight', resolvedName: 'Sir Aldric' }],
};

describe('parseExtractionResult', () => {
  it('parses valid JSON extraction result', () => {
    const result = parseExtractionResult(JSON.stringify(VALID_RESULT));

    expect(result).not.toBeNull();
    expect(result?.characters).toHaveLength(1);
    expect(result?.characters[0]?.name).toBe('Sir Aldric');
    expect(result?.moments).toHaveLength(1);
    expect(result?.locations).toHaveLength(1);
    expect(result?.scene?.characters).toEqual(['Sir Aldric']);
    expect(result?.aliases).toHaveLength(1);
  });

  it('extracts JSON from response with surrounding prose', () => {
    const raw = `Here is the extraction:\n\n${JSON.stringify(VALID_RESULT)}\n\nI hope this helps!`;
    const result = parseExtractionResult(raw);

    expect(result).not.toBeNull();
    expect(result?.characters).toHaveLength(1);
  });

  it('extracts JSON from code-fenced response', () => {
    const raw = `\`\`\`json\n${JSON.stringify(VALID_RESULT)}\n\`\`\``;
    const result = parseExtractionResult(raw);

    expect(result).not.toBeNull();
    expect(result?.characters).toHaveLength(1);
  });

  it('returns null for invalid JSON', () => {
    const result = parseExtractionResult('not json at all');

    expect(result).toBeNull();
  });

  it('returns null for empty input', () => {
    const result = parseExtractionResult('');

    expect(result).toBeNull();
  });

  it('handles partial data with defaults', () => {
    const partial = { characters: [], moments: [] };
    const result = parseExtractionResult(JSON.stringify(partial));

    expect(result).not.toBeNull();
    expect(result?.locations).toEqual([]);
    expect(result?.scene).toBeNull();
    expect(result?.aliases).toEqual([]);
  });

  it('returns null when characters have invalid action', () => {
    const invalid = {
      ...VALID_RESULT,
      characters: [{ action: 'delete', name: 'Test', fields: {} }],
    };
    const result = parseExtractionResult(JSON.stringify(invalid));

    expect(result).toBeNull();
  });

  it('returns null when moment importance is out of range', () => {
    const invalid = {
      ...VALID_RESULT,
      moments: [{ summary: 'test', kind: 'action', importance: 15, characters: [] }],
    };
    const result = parseExtractionResult(JSON.stringify(invalid));

    expect(result).toBeNull();
  });

  it('accepts scene with null location and storyTime', () => {
    const data = {
      ...VALID_RESULT,
      scene: { characters: ['Test'], location: null, storyTime: null },
    };
    const result = parseExtractionResult(JSON.stringify(data));

    expect(result).not.toBeNull();
    expect(result?.scene?.location).toBeNull();
    expect(result?.scene?.storyTime).toBeNull();
  });

  it('accepts null scene', () => {
    const data = { ...VALID_RESULT, scene: null };
    const result = parseExtractionResult(JSON.stringify(data));

    expect(result).not.toBeNull();
    expect(result?.scene).toBeNull();
  });

  it('preserves optional moment fields', () => {
    const data = {
      ...VALID_RESULT,
      moments: [
        {
          summary: 'A dramatic encounter',
          description: 'Longer description',
          storyTime: 'Midnight',
          locationId: 'loc-1',
          kind: 'revelation',
          importance: 9,
          characters: [
            {
              name: 'Elena',
              role: 'protagonist',
              perspective: 'She saw the truth',
              emotionalImpact: 'Devastated',
              knowledgeGained: 'The king is dead',
            },
          ],
        },
      ],
    };
    const result = parseExtractionResult(JSON.stringify(data));

    expect(result).not.toBeNull();
    const moment = result?.moments[0];
    expect(moment?.description).toBe('Longer description');
    expect(moment?.storyTime).toBe('Midnight');
    expect(moment?.characters[0]?.perspective).toBe('She saw the truth');
    expect(moment?.characters[0]?.knowledgeGained).toBe('The king is dead');
  });
});
