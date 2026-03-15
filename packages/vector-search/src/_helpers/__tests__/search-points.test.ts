import { describe, expect, it, vi } from 'vitest';

vi.mock('../embedder.js', () => ({
  embedSingle: vi.fn(),
}));

import { embedSingle } from '../embedder.js';
import { searchPoints } from '../search-points.js';

const makeClient = (points: Array<{ id: string; score: number; payload: Record<string, unknown> }>) => ({
  query: vi.fn().mockResolvedValue({ points }),
});

describe('searchPoints', () => {
  it('embeds the query and searches the collection', async () => {
    const vector = [0.1, 0.2, 0.3];
    vi.mocked(embedSingle).mockResolvedValue(vector);

    const client = makeClient([{ id: 'p1', score: 0.95, payload: { text: 'hello' } }]);

    const results = await searchPoints(client as never, 'messages', 'hello');

    expect(embedSingle).toHaveBeenCalledWith('hello');
    expect(client.query).toHaveBeenCalledWith('messages', {
      query: vector,
      filter: undefined,
      with_payload: true,
      limit: 10,
    });
    expect(results).toEqual([{ id: 'p1', score: 0.95, payload: { text: 'hello' } }]);
  });

  it('passes filter and limit options to Qdrant', async () => {
    vi.mocked(embedSingle).mockResolvedValue([0.1]);
    const client = makeClient([]);

    const filter = { must: [{ key: 'agentId', match: { value: 'a1' } }] };
    await searchPoints(client as never, 'threads', 'test', {
      filter,
      limit: 5,
    });

    expect(client.query).toHaveBeenCalledWith('threads', {
      query: [0.1],
      filter,
      with_payload: true,
      limit: 5,
    });
  });

  it('maps Qdrant points to SearchHit objects', async () => {
    vi.mocked(embedSingle).mockResolvedValue([0.5]);

    const client = makeClient([
      { id: 'a', score: 0.9, payload: { key: 'val' } },
      { id: 'b', score: 0.7, payload: { key: 'other' } },
    ]);

    const results = await searchPoints(client as never, 'files', 'query');

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: 'a', score: 0.9, payload: { key: 'val' } });
    expect(results[1]).toEqual({ id: 'b', score: 0.7, payload: { key: 'other' } });
  });
});
