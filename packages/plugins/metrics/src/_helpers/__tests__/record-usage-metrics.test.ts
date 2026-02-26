import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateMany = vi.fn();

vi.mock('database', () => ({
  prisma: {
    metric: {
      createMany: (...args: unknown[]) => mockCreateMany(...args),
    },
  },
}));

const { recordUsageMetrics } = await import('../record-usage-metrics');

describe('recordUsageMetrics', () => {
  beforeEach(() => {
    mockCreateMany.mockReset();
    mockCreateMany.mockResolvedValue({ count: 4 });
  });

  it('creates four metric records (input, output, total, cost)', async () => {
    const db = { metric: { createMany: mockCreateMany } } as never;

    await recordUsageMetrics(db, {
      threadId: 'thread-1',
      model: 'sonnet',
      inputTokens: 1000,
      outputTokens: 500,
      costEstimate: 0.0105,
    });

    expect(mockCreateMany).toHaveBeenCalledOnce();
    const call = mockCreateMany.mock.calls[0]?.[0];
    expect(call.data).toHaveLength(4);
  });

  it('records token.input metric with correct value and tags', async () => {
    const db = { metric: { createMany: mockCreateMany } } as never;

    await recordUsageMetrics(db, {
      threadId: 'thread-1',
      model: 'sonnet',
      inputTokens: 2000,
      outputTokens: 800,
      costEstimate: 0.018,
    });

    const call = mockCreateMany.mock.calls[0]?.[0];
    const inputMetric = call.data.find((m: { name: string }) => m.name === 'token.input');
    expect(inputMetric).toEqual({
      name: 'token.input',
      value: 2000,
      tags: { model: 'sonnet' },
      threadId: 'thread-1',
    });
  });

  it('records token.output metric with correct value', async () => {
    const db = { metric: { createMany: mockCreateMany } } as never;

    await recordUsageMetrics(db, {
      threadId: 'thread-1',
      model: 'opus',
      inputTokens: 1000,
      outputTokens: 500,
      costEstimate: 0.0525,
    });

    const call = mockCreateMany.mock.calls[0]?.[0];
    const outputMetric = call.data.find((m: { name: string }) => m.name === 'token.output');
    expect(outputMetric?.value).toBe(500);
    expect(outputMetric?.tags).toEqual({ model: 'opus' });
  });

  it('records token.total as sum of input + output', async () => {
    const db = { metric: { createMany: mockCreateMany } } as never;

    await recordUsageMetrics(db, {
      threadId: 'thread-1',
      model: 'sonnet',
      inputTokens: 3000,
      outputTokens: 1500,
      costEstimate: 0.0315,
    });

    const call = mockCreateMany.mock.calls[0]?.[0];
    const totalMetric = call.data.find((m: { name: string }) => m.name === 'token.total');
    expect(totalMetric?.value).toBe(4500);
  });

  it('records token.cost metric', async () => {
    const db = { metric: { createMany: mockCreateMany } } as never;

    await recordUsageMetrics(db, {
      threadId: 'thread-1',
      model: 'haiku',
      inputTokens: 1000,
      outputTokens: 500,
      costEstimate: 0.0028,
    });

    const call = mockCreateMany.mock.calls[0]?.[0];
    const costMetric = call.data.find((m: { name: string }) => m.name === 'token.cost');
    expect(costMetric?.value).toBe(0.0028);
  });
});
