export const EMBEDDING_DIMENSION = 384;

export const COLLECTION_NAMES = {
  messages: 'messages',
  threads: 'threads',
  files: 'files',
  storyCharacters: 'story-characters',
} as const;

export type CollectionName = (typeof COLLECTION_NAMES)[keyof typeof COLLECTION_NAMES];
