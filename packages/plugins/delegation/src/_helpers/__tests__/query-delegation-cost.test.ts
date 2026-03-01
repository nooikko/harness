import { describe, expect, it, vi } from 'vitest';
import { queryDelegationCost } from '../query-delegation-cost';

type MockDb = {
  agentRun: {
    aggregate: ReturnType<typeof vi.fn>;
  };
};

describe('queryDelegationCost', () => {
  it('returns the sum of costEstimate for a task', async () => {
    const db: MockDb = {
      agentRun: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { costEstimate: 3.75 } }),
      },
    };

    const cost = await queryDelegationCost(db as never, 'task-1');

    expect(cost).toBe(3.75);
    expect(db.agentRun.aggregate).toHaveBeenCalledWith({
      where: { taskId: 'task-1' },
      _sum: { costEstimate: true },
    });
  });

  it('returns 0 when no agent runs exist for the task', async () => {
    const db: MockDb = {
      agentRun: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { costEstimate: null } }),
      },
    };

    const cost = await queryDelegationCost(db as never, 'task-empty');

    expect(cost).toBe(0);
  });

  it('returns 0 when costEstimate sum is null', async () => {
    const db: MockDb = {
      agentRun: {
        aggregate: vi.fn().mockResolvedValue({ _sum: {} }),
      },
    };

    const cost = await queryDelegationCost(db as never, 'task-1');

    expect(cost).toBe(0);
  });
});
