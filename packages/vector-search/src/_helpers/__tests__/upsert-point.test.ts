import { describe, expect, it, vi } from 'vitest';

vi.mock('../embedder.js', () => ({
  embedSingle: vi.fn(),
}));

import { embedSingle } from '../embedder.js';
import { upsertPoint } from '../upsert-point.js';

const makeClient = () => ({
  upsert: vi.fn().mockResolvedValue(undefined),
});

describe('upsertPoint', () => {
  it('embeds the text and upserts with the payload', async () => {
    const vector = [0.1, 0.2, 0.3];
    vi.mocked(embedSingle).mockResolvedValue(vector);

    const client = makeClient();
    const payload = { agentId: 'agent-1', importance: 8 };

    await upsertPoint(client as never, 'messages', 'point-id', 'some text', payload);

    expect(embedSingle).toHaveBeenCalledWith('some text');
    expect(client.upsert).toHaveBeenCalledWith('messages', {
      wait: true,
      points: [
        {
          id: 'point-id',
          vector,
          payload: { agentId: 'agent-1', importance: 8, text: 'some text' },
        },
      ],
    });
  });

  it('includes the text in the payload alongside existing fields', async () => {
    vi.mocked(embedSingle).mockResolvedValue([0.5]);
    const client = makeClient();

    await upsertPoint(client as never, 'files', 'f1', 'file content', {
      path: '/a.ts',
    });

    const upsertCall = client.upsert.mock.calls[0];
    const pointPayload = upsertCall?.[1]?.points?.[0]?.payload;
    expect(pointPayload).toEqual({ path: '/a.ts', text: 'file content' });
  });
});
