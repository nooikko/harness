// Calculates how many milliseconds to wait before the next delegation iteration.
// Logic errors get zero backoff (fast-fail on next check); transient failures
// get exponential backoff with jitter to avoid thundering-herd retries.

import type { FailureCategory } from './categorize-failure';

type CalculateBackoffMs = (iteration: number, category: FailureCategory) => number;

export const calculateBackoffMs: CalculateBackoffMs = (iteration, category) => {
  if (category === 'logic-error') {
    // No point waiting — the same prompt will fail the same way
    return 0;
  }

  // Exponential backoff: 1s → 4s → 9s for iterations 1, 2, 3
  // Plus up to 500ms random jitter to avoid thundering herd
  const base = iteration * iteration * 1000;
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
};
