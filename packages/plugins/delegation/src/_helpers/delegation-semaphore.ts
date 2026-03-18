// Concurrency limiter for delegation loops — enforces maxConcurrentAgents

type DelegationSemaphore = {
  tryAcquire: (limit: number) => boolean;
  release: () => void;
  active: () => number;
};

type CreateDelegationSemaphore = () => DelegationSemaphore;

export const createDelegationSemaphore: CreateDelegationSemaphore = () => {
  let count = 0;

  return {
    tryAcquire: (limit: number) => {
      if (count >= limit) {
        return false;
      }
      count++;
      return true;
    },
    release: () => {
      count = Math.max(0, count - 1);
    },
    active: () => count,
  };
};
