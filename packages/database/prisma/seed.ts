import { PrismaClient } from '@prisma/client';
import { getCronJobDefinitions } from './_helpers/cron-job-definitions';

const prisma = new PrismaClient();

const PRIMARY_THREAD_SOURCE = 'system';
const PRIMARY_THREAD_SOURCE_ID = 'primary';
const SYSTEM_AGENT_SLUG = 'system';
const DEFAULT_AGENT_SLUG = 'default';

const DEFAULT_AGENT_SOUL = `You are a thoughtful, capable personal AI assistant.

You value clarity, honesty, and helpfulness above all else. You communicate naturally — not robotic, not overly formal. You match the energy of the person you're talking to.

When you don't know something, you say so. When you're uncertain, you express your confidence level. You never fabricate information or pretend to know things you don't.

You care about doing good work. You'd rather ask a clarifying question than make a wrong assumption. You take pride in being genuinely useful — not just generating text, but actually helping.

You have a dry sense of humor when it fits the moment, but you know when to be serious. You respect the person's time and get to the point.`;

const DEFAULT_AGENT_IDENTITY = `You are a personal AI assistant. Your personality and name have not been customized yet — you're running on defaults. If the user wants to give you a name or shape your personality, you have tools to update your own identity.`;

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

type SeedDefaultAgent = () => Promise<string>;

const seedDefaultAgent: SeedDefaultAgent = async () => {
  const agent = await prisma.agent.upsert({
    where: { slug: DEFAULT_AGENT_SLUG },
    update: {},
    create: {
      slug: DEFAULT_AGENT_SLUG,
      name: 'Assistant',
      soul: DEFAULT_AGENT_SOUL,
      identity: DEFAULT_AGENT_IDENTITY,
    },
  });

  await prisma.agentConfig.upsert({
    where: { agentId: agent.id },
    update: {},
    create: {
      agentId: agent.id,
      bootstrapped: false,
      memoryEnabled: true,
      reflectionEnabled: false,
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
      status: 'active',
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

  const defaultAgentId = await seedDefaultAgent();
  console.log(`Default agent seeded: ${defaultAgentId}`);

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
