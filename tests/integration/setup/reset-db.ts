import type { PrismaClient } from '@harness/database';
import { requireTestDatabaseUrl } from './require-test-db';

export const resetDatabase = async (prisma: PrismaClient): Promise<void> => {
  requireTestDatabaseUrl();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Message",
      "OrchestratorTask",
      "AgentRun",
      "CronJob",
      "Metric",
      "PluginConfig",
      "AgentMemory",
      "AgentConfig",
      "ThreadAudit",
      "Agent",
      "Project",
      "Thread"
    RESTART IDENTITY CASCADE
  `);
};
