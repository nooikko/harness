// Concurrency limiter for delegation loops — enforces maxConcurrentAgents
// Supports per-plan limits for workspace tasks alongside the global limit

type DelegationSemaphore = {
  tryAcquire: (limit: number, planId?: string) => boolean;
  release: (planId?: string) => void;
  active: (planId?: string) => number;
};

type CreateDelegationSemaphore = () => DelegationSemaphore;

export const createDelegationSemaphore: CreateDelegationSemaphore = () => {
  let globalCount = 0;
  const planCounts = new Map<string, number>();

  return {
    tryAcquire: (limit: number, planId?: string) => {
      if (planId) {
        const current = planCounts.get(planId) ?? 0;
        if (current >= limit) {
          return false;
        }
        planCounts.set(planId, current + 1);
        return true;
      }
      // Global semaphore for non-workspace delegation
      if (globalCount >= limit) {
        return false;
      }
      globalCount++;
      return true;
    },
    release: (planId?: string) => {
      if (planId) {
        const current = planCounts.get(planId) ?? 0;
        const next = Math.max(0, current - 1);
        if (next === 0) {
          planCounts.delete(planId);
        } else {
          planCounts.set(planId, next);
        }
        return;
      }
      globalCount = Math.max(0, globalCount - 1);
    },
    active: (planId?: string) => {
      if (planId) {
        return planCounts.get(planId) ?? 0;
      }
      return globalCount;
    },
  };
};
