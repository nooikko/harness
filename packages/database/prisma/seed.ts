import { PrismaClient } from '@prisma/client';
import { getAgentDefinitions } from './_helpers/agent-definitions';
import { getCronJobDefinitions } from './_helpers/cron-job-definitions';
import { getProjectDefinitions } from './_helpers/project-definitions';

const prisma = new PrismaClient();

const PRIMARY_THREAD_SOURCE = 'system';
const PRIMARY_THREAD_SOURCE_ID = 'primary';

// Seed scripts use process.stdout — not a long-running service, no need for structured logging
type Log = (message: string) => void;
const log: Log = (message) => process.stdout.write(`${message}\n`);

// ── Agents ──────────────────────────────────────────────────────────────────

type SeedAgents = () => Promise<Map<string, string>>;

const seedAgents: SeedAgents = async () => {
  const definitions = getAgentDefinitions();
  const slugToId = new Map<string, string>();

  for (const def of definitions) {
    const agent = await prisma.agent.upsert({
      where: { slug: def.slug },
      update: {
        name: def.name,
        soul: def.soul,
        identity: def.identity,
        role: def.role ?? null,
        goal: def.goal ?? null,
        backstory: def.backstory ?? null,
        userContext: def.userContext ?? null,
      },
      create: {
        slug: def.slug,
        name: def.name,
        soul: def.soul,
        identity: def.identity,
        role: def.role,
        goal: def.goal,
        backstory: def.backstory,
        userContext: def.userContext,
      },
    });

    await prisma.agentConfig.upsert({
      where: { agentId: agent.id },
      update: {},
      create: {
        agentId: agent.id,
        bootstrapped: def.config.bootstrapped,
        memoryEnabled: def.config.memoryEnabled,
        reflectionEnabled: def.config.reflectionEnabled,
      },
    });

    slugToId.set(def.slug, agent.id);
    log(`  Agent seeded: ${def.name} (${def.slug})`);
  }

  return slugToId;
};

// ── Projects ────────────────────────────────────────────────────────────────

type SeedProjects = () => Promise<Map<string, string>>;

const seedProjects: SeedProjects = async () => {
  const definitions = getProjectDefinitions();
  const idMap = new Map<string, string>();

  for (const def of definitions) {
    const project = await prisma.project.upsert({
      where: { id: def.id },
      update: {},
      create: {
        id: def.id,
        name: def.name,
        description: def.description,
      },
    });

    idMap.set(def.id, project.id);
    log(`  Project seeded: ${def.name}`);
  }

  return idMap;
};

// ── Primary Thread ──────────────────────────────────────────────────────────

type SeedPrimaryThread = (agentId: string, projectId: string) => Promise<string>;

const seedPrimaryThread: SeedPrimaryThread = async (agentId, projectId) => {
  const thread = await prisma.thread.upsert({
    where: {
      source_sourceId: {
        source: PRIMARY_THREAD_SOURCE,
        sourceId: PRIMARY_THREAD_SOURCE_ID,
      },
    },
    update: { projectId },
    create: {
      source: PRIMARY_THREAD_SOURCE,
      sourceId: PRIMARY_THREAD_SOURCE_ID,
      name: 'Primary Assistant',
      kind: 'primary',
      status: 'active',
      agentId,
      projectId,
    },
  });

  return thread.id;
};

// ── Cron Jobs ───────────────────────────────────────────────────────────────

type SeedCronJobs = (primaryThreadId: string, agentsBySlug: Map<string, string>) => Promise<void>;

const seedCronJobs: SeedCronJobs = async (primaryThreadId, agentsBySlug) => {
  const definitions = getCronJobDefinitions();

  for (const def of definitions) {
    const agentId = agentsBySlug.get(def.agentSlug);
    if (!agentId) {
      log(`  WARN: Skipping cron job "${def.name}": agent "${def.agentSlug}" not found`);
      continue;
    }

    // System agent cron jobs use the primary thread; others use lazy thread creation
    const threadId = def.agentSlug === 'system' ? primaryThreadId : null;

    await prisma.cronJob.upsert({
      where: { name: def.name },
      update: {
        schedule: def.schedule,
        prompt: def.prompt,
        enabled: def.enabled,
      },
      create: {
        name: def.name,
        schedule: def.schedule,
        prompt: def.prompt,
        enabled: def.enabled,
        threadId,
        projectId: def.projectId ?? null,
        agentId,
      },
    });

    log(`  Cron job seeded: ${def.name} (${def.agentSlug})`);
  }
};

// ── User Profile ────────────────────────────────────────────────────────────

type SeedUserProfile = () => Promise<void>;

const seedUserProfile: SeedUserProfile = async () => {
  await prisma.userProfile.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {},
  });
};

// ── Main ────────────────────────────────────────────────────────────────────

type Seed = () => Promise<void>;

const seed: Seed = async () => {
  log('Seeding database...\n');

  log('Agents:');
  const agentsBySlug = await seedAgents();

  log('\nProjects:');
  const projectsById = await seedProjects();

  const defaultAgentId = agentsBySlug.get('default');
  const generalProjectId = projectsById.get('seed_default_project_001');

  if (!defaultAgentId || !generalProjectId) {
    throw new Error('Default agent or General project not found after seeding');
  }

  log('\nPrimary thread:');
  const primaryThreadId = await seedPrimaryThread(defaultAgentId, generalProjectId);
  log(`  Primary thread seeded: ${primaryThreadId}`);

  log('\nCron jobs:');
  await seedCronJobs(primaryThreadId, agentsBySlug);

  await seedUserProfile();

  log('\nSeed complete.');
};

seed()
  .catch((error: unknown) => {
    process.stderr.write(`Seed failed: ${String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
