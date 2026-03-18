import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateMany = vi.fn();

import { recordUsageMetrics } from '../record-usage-metrics';

describe('recordUsageMetrics', () => {
  beforeEach(() => {
    mockCreateMany.mockReset();
    mockCreateMany.mockResolvedValue({ count: 4 });
  });

  it('writes all four metric records with correct names, values, and tags', async () => {
    const db = { metric: { createMany: mockCreateMany } } as never;

    await recordUsageMetrics(db, {
      threadId: 'thread-1',
      model: 'opus',
      inputTokens: 2000,
      outputTokens: 800,
      costEstimate: 0.09,
    });

    expect(mockCreateMany).toHaveBeenCalledOnce();
    const call = mockCreateMany.mock.calls[0];
    const { data } = call![0] as { data: Array<Record<string, unknown>> };
    expect(data).toEqual([
      {
        name: 'token.input',
        value: 2000,
        tags: { model: 'opus' },
        threadId: 'thread-1',
      },
      {
        name: 'token.output',
        value: 800,
        tags: { model: 'opus' },
        threadId: 'thread-1',
      },
      {
        name: 'token.total',
        value: 2800,
        tags: { model: 'opus' },
        threadId: 'thread-1',
      },
      {
        name: 'token.cost',
        value: 0.09,
        tags: { model: 'opus' },
        threadId: 'thread-1',
      },
    ]);
  });
});
