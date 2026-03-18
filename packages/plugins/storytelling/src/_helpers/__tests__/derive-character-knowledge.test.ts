import { describe, expect, it } from 'vitest';
import { deriveCharacterKnowledge } from '../derive-character-knowledge';

describe('deriveCharacterKnowledge', () => {
  const characterId = 'char-1';

  it('collects knows from knowledgeGained fields', () => {
    const characterMoments = [
      { characterId, characterName: 'Sam', momentId: 'm1', knowledgeGained: 'Elena feels the same way' },
      { characterId, characterName: 'Sam', momentId: 'm2', knowledgeGained: "Rebecca's history" },
      { characterId, characterName: 'Sam', momentId: 'm3', knowledgeGained: null },
    ];
    const allMoments = [
      { id: 'm1', summary: 'Kiss scene', importance: 8 },
      { id: 'm2', summary: 'Rebecca reveals past', importance: 7 },
      { id: 'm3', summary: 'Walking home', importance: 3 },
    ];

    const result = deriveCharacterKnowledge(characterId, characterMoments, allMoments);

    expect(result.knows).toContain('Elena feels the same way');
    expect(result.knows).toContain("Rebecca's history");
    expect(result.knows).toHaveLength(2);
  });

  it('identifies doesNotKnow from high-importance moments character missed', () => {
    const characterMoments = [{ characterId, characterName: 'Sam', momentId: 'm1', knowledgeGained: 'Something' }];
    const allMoments = [
      { id: 'm1', summary: 'Kiss scene', importance: 8 },
      { id: 'm2', summary: 'Marcus returned to town', importance: 9 },
      { id: 'm3', summary: 'Dog barked at mailman', importance: 2 },
      { id: 'm4', summary: 'Secret meeting at docks', importance: 7 },
    ];

    const result = deriveCharacterKnowledge(characterId, characterMoments, allMoments);

    expect(result.doesNotKnow).toContain('Marcus returned to town');
    expect(result.doesNotKnow).toContain('Secret meeting at docks');
    expect(result.doesNotKnow).not.toContain('Dog barked at mailman');
    expect(result.doesNotKnow).not.toContain('Kiss scene');
  });

  it('deduplicates knows entries', () => {
    const characterMoments = [
      { characterId, characterName: 'Sam', momentId: 'm1', knowledgeGained: 'The secret' },
      { characterId, characterName: 'Sam', momentId: 'm2', knowledgeGained: 'The secret' },
    ];
    const allMoments = [
      { id: 'm1', summary: 'First reveal', importance: 5 },
      { id: 'm2', summary: 'Second mention', importance: 5 },
    ];

    const result = deriveCharacterKnowledge(characterId, characterMoments, allMoments);

    expect(result.knows).toHaveLength(1);
    expect(result.knows).toContain('The secret');
  });

  it('deduplicates doesNotKnow entries', () => {
    const characterMoments: { characterId: string; characterName: string; momentId: string; knowledgeGained: string | null }[] = [];
    const allMoments = [
      { id: 'm1', summary: 'Betrayal at the bridge', importance: 8 },
      { id: 'm2', summary: 'Betrayal at the bridge', importance: 9 },
    ];

    const result = deriveCharacterKnowledge(characterId, characterMoments, allMoments);

    expect(result.doesNotKnow).toHaveLength(1);
  });

  it('returns empty arrays when character has no moments and no significant events exist', () => {
    const result = deriveCharacterKnowledge(characterId, [], []);

    expect(result.knows).toEqual([]);
    expect(result.doesNotKnow).toEqual([]);
  });

  it('excludes moments with importance below 7 from doesNotKnow', () => {
    const allMoments = [
      { id: 'm1', summary: 'Minor chat', importance: 6 },
      { id: 'm2', summary: 'Casual lunch', importance: 5 },
    ];

    const result = deriveCharacterKnowledge(characterId, [], allMoments);

    expect(result.doesNotKnow).toEqual([]);
  });
});
