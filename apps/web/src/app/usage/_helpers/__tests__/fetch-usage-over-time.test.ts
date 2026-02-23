import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('database', () => ({
  prisma: {
    metric: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { fetchUsageOverTime } = await import('../fetch-usage-over-time');

describe('fetchUsageOverTime', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it('returns daily aggregated usage', async () => {
    mockFindMany
      .mockResolvedValueOnce([
        // token.total metrics
        { value: 1000, createdAt: new Date('2025-01-15T10:00:00Z') },
        { value: 500, createdAt: new Date('2025-01-15T14:00:00Z') },
        { value: 2000, createdAt: new Date('2025-01-16T10:00:00Z') },
      ])
      .mockResolvedValueOnce([
        // token.cost metrics
        { value: 0.005, createdAt: new Date('2025-01-15T10:00:00Z') },
        { value: 0.003, createdAt: new Date('2025-01-15T14:00:00Z') },
        { value: 0.01, createdAt: new Date('2025-01-16T10:00:00Z') },
      ]);

    const result = await fetchUsageOverTime(30);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2025-01-15',
      totalTokens: 1500,
      totalCost: 0.008,
    });
    expect(result[1]).toEqual({
      date: '2025-01-16',
      totalTokens: 2000,
      totalCost: 0.01,
    });
  });

  it('returns empty array when no metrics exist', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await fetchUsageOverTime();

    expect(result).toEqual([]);
  });

  it('handles cost metrics for dates not present in token metrics', async () => {
    mockFindMany
      .mockResolvedValueOnce([
        // token.total metric only on Jan 15
        { value: 1000, createdAt: new Date('2025-01-15T10:00:00Z') },
      ])
      .mockResolvedValueOnce([
        // token.cost metric on Jan 15 AND Jan 16 (no token.total for Jan 16)
        { value: 0.005, createdAt: new Date('2025-01-15T10:00:00Z') },
        { value: 0.01, createdAt: new Date('2025-01-16T10:00:00Z') },
      ]);

    const result = await fetchUsageOverTime(30);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: '2025-01-15', totalTokens: 1000, totalCost: 0.005 });
    expect(result[1]).toEqual({ date: '2025-01-16', totalTokens: 0, totalCost: 0.01 });
  });

  it('sorts results by date ascending', async () => {
    mockFindMany
      .mockResolvedValueOnce([
        { value: 100, createdAt: new Date('2025-01-20T10:00:00Z') },
        { value: 200, createdAt: new Date('2025-01-18T10:00:00Z') },
      ])
      .mockResolvedValueOnce([]);

    const result = await fetchUsageOverTime();

    expect(result[0]?.date).toBe('2025-01-18');
    expect(result[1]?.date).toBe('2025-01-20');
  });
});
