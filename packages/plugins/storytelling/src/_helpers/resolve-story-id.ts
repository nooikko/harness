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
  storyCache.set(threadId, storyId);
  return storyId;
};
