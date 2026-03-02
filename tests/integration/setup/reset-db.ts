import type { PrismaClient } from '@harness/database';

export const resetDatabase = async (prisma: PrismaClient): Promise<void> => {
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
