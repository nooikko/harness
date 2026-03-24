import { describe, expect, it } from 'vitest';
import { COLLECTION_NAMES, EMBEDDING_DIMENSION } from '../collections.js';

describe('collections', () => {
  it('exposes messages, threads, and files collection names', () => {
    expect(Object.keys(COLLECTION_NAMES)).toEqual(expect.arrayContaining(['messages', 'threads', 'files', 'storyCharacters']));
    expect(Object.keys(COLLECTION_NAMES)).toHaveLength(4);
  });

  it('sets EMBEDDING_DIMENSION to 384', () => {
    expect(EMBEDDING_DIMENSION).toBe(384);
  });
});
