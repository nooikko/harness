import type { AgentConfig, PrismaClient } from '@harness/database';

type LoadAgentConfig = (db: PrismaClient, agentId: string) => Promise<AgentConfig | null>;

export const loadAgentConfig: LoadAgentConfig = async (db, agentId) => {
  return db.agentConfig.findUnique({ where: { agentId } });
};
