import type { Agent, PrismaClient } from '@harness/database';

type LoadAgent = (db: PrismaClient, threadId: string) => Promise<Agent | null>;

export const loadAgent: LoadAgent = async (db, threadId) => {
  const thread = await db.thread.findUnique({
    where: { id: threadId },
    select: { agentId: true },
  });
  if (!thread?.agentId) {
    return null;
  }

  return db.agent.findFirst({
    where: { id: thread.agentId, enabled: true },
  });
};
