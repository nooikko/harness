import { PrismaClient } from '@prisma/client';
import { getCronJobDefinitions } from './_helpers/cron-job-definitions';

const prisma = new PrismaClient();

const PRIMARY_THREAD_SOURCE = 'system';
const PRIMARY_THREAD_SOURCE_ID = 'primary';
const SYSTEM_AGENT_SLUG = 'system';

type SeedSystemAgent = () => Promise<string>;

const seedSystemAgent: SeedSystemAgent = async () => {
  const agent = await prisma.agent.upsert({
    where: { slug: SYSTEM_AGENT_SLUG },
    update: {},
    create: {
      slug: SYSTEM_AGENT_SLUG,
      name: 'System',
      soul: 'You are a system agent that handles automated tasks like cron jobs, digests, and maintenance routines.',
      identity: 'System automation agent for the Harness orchestrator.',
    },
  });

  return agent.id;
};

type SeedPrimaryThread = (agentId: string) => Promise<string>;

const seedPrimaryThread: SeedPrimaryThread = async (agentId) => {
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
      agentId,
    },
  });

  return thread.id;
};

type SeedCronJobs = (threadId: string, agentId: string) => Promise<void>;

const seedCronJobs: SeedCronJobs = async (threadId, agentId) => {
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
        agent: { connect: { id: agentId } },
      },
    });
  }
};

type Seed = () => Promise<void>;

const seed: Seed = async () => {
  console.log('Seeding database...');

  const agentId = await seedSystemAgent();
  console.log(`System agent seeded: ${agentId}`);

  const threadId = await seedPrimaryThread(agentId);
  console.log(`Primary thread seeded: ${threadId}`);

  await seedCronJobs(threadId, agentId);
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
