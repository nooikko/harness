import type { PrismaClient } from 'database';

export const resetDatabase = async (prisma: PrismaClient): Promise<void> => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "User",
      "Post",
      "Message",
      "OrchestratorTask",
      "AgentRun",
      "CronJob",
      "Metric",
      "PluginConfig",
      "Thread"
    RESTART IDENTITY CASCADE
  `);
};
