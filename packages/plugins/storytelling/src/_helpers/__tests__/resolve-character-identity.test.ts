import { describe, expect, it } from 'vitest';
import { resolveCharacterIdentity } from '../resolve-character-identity';

describe('resolveCharacterIdentity', () => {
  it('returns create when no candidates', () => {
    const result = resolveCharacterIdentity([]);

    expect(result).toEqual({ action: 'create' });
  });

  it('returns merge when best score >= 0.85', () => {
    const result = resolveCharacterIdentity([
      { characterId: 'char-1', name: 'Samuel', score: 0.92 },
      { characterId: 'char-2', name: 'Sam', score: 0.7 },
    ]);

    expect(result).toEqual({
      action: 'merge',
      targetId: 'char-1',
      targetName: 'Samuel',
    });
  });

  it('returns judge with uncertain candidates when best score is 0.65-0.85', () => {
    const result = resolveCharacterIdentity([
      { characterId: 'char-1', name: 'Samuel', score: 0.78 },
      { characterId: 'char-2', name: 'Sammy', score: 0.68 },
      { characterId: 'char-3', name: 'Steve', score: 0.5 },
    ]);

    expect(result).toEqual({
      action: 'judge',
      candidates: [
        { characterId: 'char-1', name: 'Samuel', score: 0.78 },
        { characterId: 'char-2', name: 'Sammy', score: 0.68 },
      ],
    });
  });

  it('returns create when all scores < 0.65', () => {
    const result = resolveCharacterIdentity([
      { characterId: 'char-1', name: 'Unrelated', score: 0.3 },
      { characterId: 'char-2', name: 'Nobody', score: 0.1 },
    ]);

    expect(result).toEqual({ action: 'create' });
  });

  it('judge candidates only include those >= 0.65', () => {
    const result = resolveCharacterIdentity([
      { characterId: 'char-1', name: 'Maybe', score: 0.72 },
      { characterId: 'char-2', name: 'Nope', score: 0.64 },
      { characterId: 'char-3', name: 'Nah', score: 0.4 },
    ]);

    expect(result.action).toBe('judge');
    if (result.action === 'judge') {
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]!.characterId).toBe('char-1');
    }
  });
});
