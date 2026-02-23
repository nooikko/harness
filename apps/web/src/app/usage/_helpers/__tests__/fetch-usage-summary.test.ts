import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAggregate = vi.fn();
const mockCount = vi.fn();

vi.mock('database', () => ({
  prisma: {
    metric: {
      aggregate: (...args: unknown[]) => mockAggregate(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

const { fetchUsageSummary } = await import('../fetch-usage-summary');

describe('fetchUsageSummary', () => {
  beforeEach(() => {
    mockAggregate.mockReset();
    mockCount.mockReset();
  });

  it('aggregates input, output, and cost metrics', async () => {
    mockAggregate
      .mockResolvedValueOnce({ _sum: { value: 10000 } }) // input
      .mockResolvedValueOnce({ _sum: { value: 5000 } }) // output
      .mockResolvedValueOnce({ _sum: { value: 0.105 } }); // cost
    mockCount.mockResolvedValueOnce(15); // runs

    const result = await fetchUsageSummary();

    expect(result.totalInputTokens).toBe(10000);
    expect(result.totalOutputTokens).toBe(5000);
    expect(result.totalTokens).toBe(15000);
    expect(result.totalCost).toBe(0.105);
    expect(result.totalRuns).toBe(15);
  });

  it('returns zeros when no metrics exist', async () => {
    mockAggregate.mockResolvedValue({ _sum: { value: null } });
    mockCount.mockResolvedValue(0);

    const result = await fetchUsageSummary();

    expect(result.totalInputTokens).toBe(0);
    expect(result.totalOutputTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.totalRuns).toBe(0);
  });

  it('queries the correct metric names', async () => {
    mockAggregate.mockResolvedValue({ _sum: { value: 0 } });
    mockCount.mockResolvedValue(0);

    await fetchUsageSummary();

    expect(mockAggregate).toHaveBeenCalledWith({ where: { name: 'token.input' }, _sum: { value: true } });
    expect(mockAggregate).toHaveBeenCalledWith({ where: { name: 'token.output' }, _sum: { value: true } });
    expect(mockAggregate).toHaveBeenCalledWith({ where: { name: 'token.cost' }, _sum: { value: true } });
    expect(mockCount).toHaveBeenCalledWith({ where: { name: 'token.total' } });
  });
});
