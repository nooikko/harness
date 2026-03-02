import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMetricAggregate = vi.fn();
const mockThreadFindMany = vi.fn();
const mockAgentRunAggregate = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    metric: {
      aggregate: (...args: unknown[]) => mockMetricAggregate(...args),
    },
    thread: {
      findMany: (...args: unknown[]) => mockThreadFindMany(...args),
    },
    agentRun: {
      aggregate: (...args: unknown[]) => mockAgentRunAggregate(...args),
    },
  },
}));

const { getThreadCost } = await import('../get-thread-cost');

describe('getThreadCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns correct totals when both sources have data', async () => {
    mockMetricAggregate.mockResolvedValue({ _sum: { value: 0.05 } });
    mockThreadFindMany.mockResolvedValue([{ id: 'child-1' }, { id: 'child-2' }]);
    mockAgentRunAggregate.mockResolvedValue({ _sum: { costEstimate: 0.03 } });

    const result = await getThreadCost('thread-1');

    expect(result).toEqual({
      mainCost: 0.05,
      subAgentCost: 0.03,
      totalCost: 0.08,
    });
  });

  it('returns zeros when metric aggregate is zero', async () => {
    mockMetricAggregate.mockResolvedValue({ _sum: { value: 0 } });
    mockThreadFindMany.mockResolvedValue([]);

    const result = await getThreadCost('thread-1');

    expect(result).toEqual({
      mainCost: 0,
      subAgentCost: 0,
      totalCost: 0,
    });
  });

  it('returns only mainCost when there are no child threads', async () => {
    mockMetricAggregate.mockResolvedValue({ _sum: { value: 0.12 } });
    mockThreadFindMany.mockResolvedValue([]);

    const result = await getThreadCost('thread-1');

    expect(result).toEqual({
      mainCost: 0.12,
      subAgentCost: 0,
      totalCost: 0.12,
    });
    expect(mockAgentRunAggregate).not.toHaveBeenCalled();
  });

  it('coalesces null aggregate values to zero', async () => {
    mockMetricAggregate.mockResolvedValue({ _sum: { value: null } });
    mockThreadFindMany.mockResolvedValue([{ id: 'child-1' }]);
    mockAgentRunAggregate.mockResolvedValue({ _sum: { costEstimate: null } });

    const result = await getThreadCost('thread-1');

    expect(result).toEqual({
      mainCost: 0,
      subAgentCost: 0,
      totalCost: 0,
    });
  });

  it('does not call agentRun aggregate when childIds is empty', async () => {
    mockMetricAggregate.mockResolvedValue({ _sum: { value: 0.02 } });
    mockThreadFindMany.mockResolvedValue([]);

    await getThreadCost('thread-1');

    expect(mockAgentRunAggregate).not.toHaveBeenCalled();
  });

  it('queries metric aggregate with correct thread id and name', async () => {
    mockMetricAggregate.mockResolvedValue({ _sum: { value: 0 } });
    mockThreadFindMany.mockResolvedValue([]);

    await getThreadCost('thread-abc');

    expect(mockMetricAggregate).toHaveBeenCalledWith({
      where: { threadId: 'thread-abc', name: 'token.cost' },
      _sum: { value: true },
    });
  });

  it('queries agentRun aggregate with all child thread ids', async () => {
    mockMetricAggregate.mockResolvedValue({ _sum: { value: 0 } });
    mockThreadFindMany.mockResolvedValue([{ id: 'c-1' }, { id: 'c-2' }, { id: 'c-3' }]);
    mockAgentRunAggregate.mockResolvedValue({ _sum: { costEstimate: 0.07 } });

    await getThreadCost('thread-1');

    expect(mockAgentRunAggregate).toHaveBeenCalledWith({
      where: { threadId: { in: ['c-1', 'c-2', 'c-3'] } },
      _sum: { costEstimate: true },
    });
  });
});
