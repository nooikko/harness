import { describe, expect, it } from 'vitest';
import { buildImportExtractionPrompt } from '../build-import-extraction-prompt';

describe('buildImportExtractionPrompt', () => {
  it('includes character list with personality snippets', () => {
    const result = buildImportExtractionPrompt({
      characters: [{ id: 'c1', name: 'Violet', personality: 'Guarded but kind' }],
      locations: [],
      storyTime: null,
      content: 'scene text',
    });

    expect(result).toContain('Violet (id: c1)');
    expect(result).toContain('Guarded but kind');
  });

  it('shows "(none yet)" for empty characters', () => {
    const result = buildImportExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: null,
      content: 'scene text',
    });

    expect(result).toContain('(none yet)');
  });

  it('includes location list with parent names', () => {
    const result = buildImportExtractionPrompt({
      characters: [],
      locations: [{ id: 'l1', name: 'Gym', parentName: 'School' }],
      storyTime: null,
      content: 'scene text',
    });

    expect(result).toContain('Gym (inside: School)');
  });

  it('includes locations without parent', () => {
    const result = buildImportExtractionPrompt({
      characters: [],
      locations: [{ id: 'l1', name: 'Beach' }],
      storyTime: null,
      content: 'scene text',
    });

    expect(result).toContain('Beach');
    expect(result).not.toContain('inside');
  });

  it('shows "(none yet)" for empty locations', () => {
    const result = buildImportExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: null,
      content: 'scene text',
    });

    // Both character and location sections show (none yet)
    const noneCount = (result.match(/\(none yet\)/g) ?? []).length;
    expect(noneCount).toBe(2);
  });

  it('includes story time when provided', () => {
    const result = buildImportExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: 'Day 5, Evening',
      content: 'scene text',
    });

    expect(result).toContain('Current story time: Day 5, Evening');
  });

  it('shows "not established yet" when no story time', () => {
    const result = buildImportExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: null,
      content: 'scene text',
    });

    expect(result).toContain('Story time: not established yet');
  });

  it('includes recent moments for drift detection', () => {
    const result = buildImportExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: null,
      content: 'scene text',
      recentMoments: [{ summary: 'Driver lunch scene', storyTime: 'Day 8', characterNames: ['Marcus', 'Violet'] }],
    });

    expect(result).toContain('Recently Extracted Moments');
    expect(result).toContain('Driver lunch scene');
    expect(result).toContain('Marcus, Violet');
  });

  it('omits recent moments section when empty', () => {
    const result = buildImportExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: null,
      content: 'scene text',
      recentMoments: [],
    });

    // The "watch for re-tellings" header should not appear when there are no recent moments
    expect(result).not.toContain('watch for re-tellings');
  });

  it('includes content label when provided', () => {
    const result = buildImportExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: null,
      content: 'scene text',
      contentLabel: 'Days 1-3',
    });

    expect(result).toContain('(Days 1-3)');
  });

  it('includes the content itself', () => {
    const result = buildImportExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: null,
      content: 'Violet sat on the bench.',
    });

    expect(result).toContain('Violet sat on the bench.');
  });

  it('handles characters without personality', () => {
    const result = buildImportExtractionPrompt({
      characters: [{ id: 'c1', name: 'Kai' }],
      locations: [],
      storyTime: null,
      content: 'text',
    });

    expect(result).toContain('Kai (id: c1)');
    expect(result).not.toContain('undefined');
  });

  it('truncates long personality to 100 chars', () => {
    const longPersonality = 'a'.repeat(200);
    const result = buildImportExtractionPrompt({
      characters: [{ id: 'c1', name: 'Violet', personality: longPersonality }],
      locations: [],
      storyTime: null,
      content: 'text',
    });

    // The personality snippet should be truncated
    expect(result).not.toContain('a'.repeat(200));
    expect(result).toContain('a'.repeat(100));
  });

  it('handles recent moments with null storyTime', () => {
    const result = buildImportExtractionPrompt({
      characters: [],
      locations: [],
      storyTime: null,
      content: 'text',
      recentMoments: [{ summary: 'Something happened', storyTime: null, characterNames: ['Kai'] }],
    });

    expect(result).toContain('[?] Something happened');
  });
});
