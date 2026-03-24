import { describe, expect, it, vi } from 'vitest';
import { COLLECTION_NAMES, EMBEDDING_DIMENSION } from '../collections.js';
import { ensureCollections } from '../ensure-collections.js';

const makeClient = (existingNames: string[]) => ({
  getCollections: vi.fn().mockResolvedValue({
    collections: existingNames.map((name) => ({ name })),
  }),
  createCollection: vi.fn().mockResolvedValue(undefined),
});

describe('ensureCollections', () => {
  it('creates all collections when none exist', async () => {
    const client = makeClient([]);

    await ensureCollections(client as never);

    const allNames = Object.values(COLLECTION_NAMES);
    expect(client.createCollection).toHaveBeenCalledTimes(allNames.length);
    for (const name of allNames) {
      expect(client.createCollection).toHaveBeenCalledWith(name, {
        vectors: { size: EMBEDDING_DIMENSION, distance: 'Cosine' },
      });
    }
  });

  it('skips collections that already exist', async () => {
    const allNames = Object.values(COLLECTION_NAMES);
    const client = makeClient(allNames);

    await ensureCollections(client as never);

    expect(client.createCollection).not.toHaveBeenCalled();
  });

  it('creates only missing collections when some exist', async () => {
    const client = makeClient(['messages']);

    await ensureCollections(client as never);

    expect(client.createCollection).toHaveBeenCalledTimes(3);
    expect(client.createCollection).toHaveBeenCalledWith('threads', {
      vectors: { size: EMBEDDING_DIMENSION, distance: 'Cosine' },
    });
    expect(client.createCollection).toHaveBeenCalledWith('files', {
      vectors: { size: EMBEDDING_DIMENSION, distance: 'Cosine' },
    });
    expect(client.createCollection).toHaveBeenCalledWith('story-characters', {
      vectors: { size: EMBEDDING_DIMENSION, distance: 'Cosine' },
    });
  });
});
