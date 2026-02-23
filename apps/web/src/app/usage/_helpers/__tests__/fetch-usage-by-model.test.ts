import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGroupBy = vi.fn();

vi.mock('database', () => ({
  prisma: {
    agentRun: {
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
    },
  },
}));

const { fetchUsageByModel } = await import('../fetch-usage-by-model');

describe('fetchUsageByModel', () => {
  beforeEach(() => {
    mockGroupBy.mockReset();
  });

  it('returns model usage data grouped by model', async () => {
    mockGroupBy.mockResolvedValue([
      {
        model: 'sonnet',
        _sum: { inputTokens: 5000, outputTokens: 2000, costEstimate: 0.045 },
        _count: 10,
      },
      {
        model: 'opus',
        _sum: { inputTokens: 1000, outputTokens: 500, costEstimate: 0.0525 },
        _count: 2,
      },
    ]);

    const result = await fetchUsageByModel();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      model: 'sonnet',
      totalInputTokens: 5000,
      totalOutputTokens: 2000,
      totalCost: 0.045,
      runCount: 10,
    });
  });

  it('returns empty array when no runs exist', async () => {
    mockGroupBy.mockResolvedValue([]);

    const result = await fetchUsageByModel();

    expect(result).toEqual([]);
  });

  it('handles null sums gracefully', async () => {
    mockGroupBy.mockResolvedValue([
      {
        model: 'haiku',
        _sum: { inputTokens: null, outputTokens: null, costEstimate: null },
        _count: 1,
      },
    ]);

    const result = await fetchUsageByModel();

    expect(result[0]?.totalInputTokens).toBe(0);
    expect(result[0]?.totalOutputTokens).toBe(0);
    expect(result[0]?.totalCost).toBe(0);
  });
});
