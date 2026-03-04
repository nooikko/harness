import type { Agent, PrismaClient } from '@harness/database';

type AgentWithThreadContext = Agent & {
  threadProjectId: string | null;
};

type LoadAgent = (db: PrismaClient, threadId: string) => Promise<AgentWithThreadContext | null>;

export const loadAgent: LoadAgent = async (db, threadId) => {
  const thread = await db.thread.findUnique({
    where: { id: threadId },
    select: { agentId: true, projectId: true },
  });
  if (!thread?.agentId) {
    return null;
  }

  const agent = await db.agent.findFirst({
    where: { id: thread.agentId, enabled: true },
  });
  if (!agent) {
    return null;
  }

  return { ...agent, threadProjectId: thread.projectId };
};
