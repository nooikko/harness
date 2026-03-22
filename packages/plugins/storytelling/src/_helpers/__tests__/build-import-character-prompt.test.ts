import { describe, expect, it } from 'vitest';
import { buildImportCharacterPrompt } from '../build-import-character-prompt';

describe('buildImportCharacterPrompt', () => {
  it('includes existing characters with aliases', () => {
    const result = buildImportCharacterPrompt({
      text: 'Violet is guarded.',
      existingCharacters: [{ name: 'Kai', aliases: ['K'] }],
    });

    expect(result).toContain('Kai');
    expect(result).toContain('aliases: K');
  });

  it('shows "(none yet)" when no existing characters', () => {
    const result = buildImportCharacterPrompt({
      text: 'Violet is guarded.',
      existingCharacters: [],
    });

    expect(result).toContain('(none yet)');
  });

  it('includes the profile text in the prompt', () => {
    const result = buildImportCharacterPrompt({
      text: 'Violet hides vulnerability behind sarcasm.',
      existingCharacters: [],
    });

    expect(result).toContain('Violet hides vulnerability behind sarcasm.');
  });

  it('handles existing characters without aliases', () => {
    const result = buildImportCharacterPrompt({
      text: 'profiles',
      existingCharacters: [{ name: 'Suki', aliases: [] }],
    });

    expect(result).toContain('- Suki');
    // Should NOT include "(aliases: ...)" for characters with no aliases
    expect(result).not.toContain('(aliases:');
  });

  it('instructs to preserve texture', () => {
    const result = buildImportCharacterPrompt({
      text: 'profiles',
      existingCharacters: [],
    });

    expect(result).toContain('Preserve every nuance');
  });
});
