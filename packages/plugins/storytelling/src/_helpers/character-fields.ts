export const CHARACTER_FIELDS = ['appearance', 'personality', 'mannerisms', 'motives', 'backstory', 'relationships', 'color', 'status'] as const;

type CharacterField = (typeof CHARACTER_FIELDS)[number];

export type { CharacterField };
