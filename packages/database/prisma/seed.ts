import { PrismaClient } from '@prisma/client';
import { getCronJobDefinitions } from './_helpers/cron-job-definitions';

const prisma = new PrismaClient();

const PRIMARY_THREAD_SOURCE = 'system';
const PRIMARY_THREAD_SOURCE_ID = 'primary';

type SeedPrimaryThread = () => Promise<string>;

const seedPrimaryThread: SeedPrimaryThread = async () => {
  const thread = await prisma.thread.upsert({
    where: {
      source_sourceId: {
        source: PRIMARY_THREAD_SOURCE,
        sourceId: PRIMARY_THREAD_SOURCE_ID,
      },
    },
    update: {},
    create: {
      source: PRIMARY_THREAD_SOURCE,
      sourceId: PRIMARY_THREAD_SOURCE_ID,
      name: 'Primary Assistant',
      kind: 'primary',
      status: 'open',
    },
  });

  return thread.id;
};

type SeedCronJobs = (threadId: string) => Promise<void>;

const seedCronJobs: SeedCronJobs = async (threadId) => {
  const definitions = getCronJobDefinitions();

  for (const definition of definitions) {
    await prisma.cronJob.upsert({
      where: { name: definition.name },
      update: {
        schedule: definition.schedule,
        prompt: definition.prompt,
        enabled: definition.enabled,
      },
      create: {
        name: definition.name,
        schedule: definition.schedule,
        prompt: definition.prompt,
        enabled: definition.enabled,
        threadId,
      },
    });
  }
};

type Seed = () => Promise<void>;

const seed: Seed = async () => {
  console.log('Seeding database...');

  const threadId = await seedPrimaryThread();
  console.log(`Primary thread seeded: ${threadId}`);

  await seedCronJobs(threadId);
  console.log(`Cron jobs seeded: ${getCronJobDefinitions().length} jobs`);

  console.log('Seed complete.');
};

seed()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
