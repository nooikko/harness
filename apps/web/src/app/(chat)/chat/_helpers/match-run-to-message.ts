type RunWithTimestamp = {
  startedAt: Date;
  [key: string]: unknown;
};

type MatchRunToMessage = <T extends RunWithTimestamp>(message: { createdAt: Date }, runs: T[]) => T | undefined;

/**
 * Finds the run whose `startedAt` is closest to (and not after)
 * the message's `createdAt`. Returns undefined if no qualifying run exists.
 */
export const matchRunToMessage: MatchRunToMessage = (message, runs) => {
  const messageTime = message.createdAt.getTime();
  let best: (typeof runs)[number] | undefined;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const run of runs) {
    const runTime = run.startedAt.getTime();
    const diff = messageTime - runTime;

    if (diff >= 0 && diff < bestDiff) {
      best = run;
      bestDiff = diff;
    }
  }

  return best;
};
