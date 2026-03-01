import type { Thread } from '@harness/database';

type SortThreads = (threads: Thread[]) => Thread[];

/**
 * Sorts threads with primary pinned to top, then by lastActivity descending.
 */
export const sortThreads: SortThreads = (threads) => {
  const primary: Thread[] = [];
  const rest: Thread[] = [];

  for (const thread of threads) {
    if (thread.kind === 'primary') {
      primary.push(thread);
    } else {
      rest.push(thread);
    }
  }

  rest.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

  return [...primary, ...rest];
};
