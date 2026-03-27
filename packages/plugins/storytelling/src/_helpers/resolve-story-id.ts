type DbClient = {
  thread: {
    findUnique: (args: { where: { id: string }; select: { storyId: true } }) => Promise<{ storyId: string | null } | null>;
  };
};

type ResolveStoryId = (threadId: string, storyCache: Map<string, string | null>, db: DbClient) => Promise<string | null>;

export const resolveStoryId: ResolveStoryId = async (threadId, storyCache, db) => {
  const cached = storyCache.get(threadId);
  if (cached !== undefined) {
    return cached;
  }

  const thread = await db.thread.findUnique({
    where: { id: threadId },
    select: { storyId: true },
  });

  const storyId = thread?.storyId ?? null;

  // Only cache non-null storyIds — null means "no story yet" and should
  // re-query on the next call so a later story assignment is visible
  if (storyId) {
    storyCache.set(threadId, storyId);
  }

  return storyId;
};
