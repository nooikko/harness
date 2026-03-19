import { PrismaClient } from '@prisma/client';

/**
 * Deterministic test data for E2E tests.
 * Every value is a known constant so test assertions can reference them directly.
 */

type Log = (message: string) => void;
const log: Log = (message) => process.stdout.write(`${message}\n`);

export const TEST_AGENT = {
  slug: 'e2e-test-agent',
  name: 'E2E Test Agent',
  soul: 'A helpful test agent for end-to-end testing.',
  identity: 'I am a test agent used for automated E2E testing.',
  role: 'Test Assistant',
  goal: 'Help verify application functionality',
} as const;

export const TEST_PROJECT = {
  name: 'E2E Test Project',
  description: 'A project used for end-to-end testing.',
} as const;

export const TEST_THREADS = {
  general: {
    source: 'e2e-test',
    sourceId: 'general-thread',
    name: 'E2E General Thread',
    kind: 'general',
    status: 'active',
  },
  cron: {
    source: 'e2e-test',
    sourceId: 'cron-thread',
    name: 'E2E Cron Thread',
    kind: 'cron',
    status: 'active',
  },
} as const;

export const TEST_CRON_JOBS = {
  recurring: {
    name: 'E2E Recurring Job',
    schedule: '0 12 * * *',
    prompt: 'Run the daily E2E check.',
    enabled: true,
  },
  oneShot: {
    name: 'E2E One-Shot Job',
    fireAt: new Date('2099-01-01T00:00:00Z'),
    prompt: 'Fire once for E2E testing.',
    enabled: true,
  },
  disabled: {
    name: 'E2E Disabled Job',
    schedule: '0 0 * * *',
    prompt: 'This job is disabled.',
    enabled: false,
  },
} as const;

export const TEST_TASKS = {
  todo: {
    title: 'E2E Todo Task',
    description: 'A task in TODO status for testing.',
    status: 'TODO',
    priority: 'MEDIUM',
  },
  inProgress: {
    title: 'E2E In Progress Task',
    description: 'A task in IN_PROGRESS status for testing.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
  },
  done: {
    title: 'E2E Done Task',
    description: 'A completed task for testing.',
    status: 'DONE',
    priority: 'LOW',
  },
} as const;

export const TEST_PROFILE = {
  name: 'E2E Test User',
  pronouns: 'they/them',
  location: 'Test City, TC',
} as const;

/** Calendar events seeded relative to "now" so they always appear in the default week view. */
export const TEST_CALENDAR_EVENTS = {
  today: {
    title: 'E2E Today Meeting',
    description: 'A test event happening today.',
    location: 'Test Room A',
  },
  tomorrow: {
    title: 'E2E Tomorrow Standup',
    description: 'A test event happening tomorrow.',
    location: 'Test Room B',
  },
} as const;

export type SeedResult = {
  agentId: string;
  projectId: string;
  generalThreadId: string;
  cronThreadId: string;
};

export const seedTestData = async (databaseUrl: string): Promise<SeedResult> => {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

  try {
    // Agent + config
    const agent = await prisma.agent.create({
      data: {
        slug: TEST_AGENT.slug,
        name: TEST_AGENT.name,
        soul: TEST_AGENT.soul,
        identity: TEST_AGENT.identity,
        role: TEST_AGENT.role,
        goal: TEST_AGENT.goal,
        config: {
          create: {
            memoryEnabled: true,
            reflectionEnabled: false,
            bootstrapped: true,
          },
        },
      },
    });

    // Project
    const project = await prisma.project.create({
      data: {
        name: TEST_PROJECT.name,
        description: TEST_PROJECT.description,
      },
    });

    // Threads
    const generalThread = await prisma.thread.create({
      data: {
        ...TEST_THREADS.general,
        agentId: agent.id,
        projectId: project.id,
      },
    });

    const cronThread = await prisma.thread.create({
      data: {
        ...TEST_THREADS.cron,
        agentId: agent.id,
        projectId: project.id,
      },
    });

    // Cron jobs
    await prisma.cronJob.create({
      data: {
        ...TEST_CRON_JOBS.recurring,
        agentId: agent.id,
        threadId: generalThread.id,
      },
    });

    await prisma.cronJob.create({
      data: {
        name: TEST_CRON_JOBS.oneShot.name,
        fireAt: TEST_CRON_JOBS.oneShot.fireAt,
        prompt: TEST_CRON_JOBS.oneShot.prompt,
        enabled: TEST_CRON_JOBS.oneShot.enabled,
        agentId: agent.id,
      },
    });

    await prisma.cronJob.create({
      data: {
        ...TEST_CRON_JOBS.disabled,
        agentId: agent.id,
      },
    });

    // User tasks
    for (const task of Object.values(TEST_TASKS)) {
      await prisma.userTask.create({
        data: {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          projectId: project.id,
        },
      });
    }

    // Calendar events (relative to now so they appear in the default week view)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0);
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 30);

    await prisma.calendarEvent.create({
      data: {
        source: 'LOCAL',
        title: TEST_CALENDAR_EVENTS.today.title,
        description: TEST_CALENDAR_EVENTS.today.description,
        location: TEST_CALENDAR_EVENTS.today.location,
        startAt: todayStart,
        endAt: todayEnd,
      },
    });

    await prisma.calendarEvent.create({
      data: {
        source: 'LOCAL',
        title: TEST_CALENDAR_EVENTS.tomorrow.title,
        description: TEST_CALENDAR_EVENTS.tomorrow.description,
        location: TEST_CALENDAR_EVENTS.tomorrow.location,
        startAt: tomorrowStart,
        endAt: tomorrowEnd,
      },
    });

    // User profile
    await prisma.userProfile.create({
      data: {
        id: 'singleton',
        name: TEST_PROFILE.name,
        pronouns: TEST_PROFILE.pronouns,
        location: TEST_PROFILE.location,
      },
    });

    // Plugin configs (a couple enabled, one disabled)
    await prisma.pluginConfig.createMany({
      data: [
        { pluginName: 'web', enabled: true },
        { pluginName: 'context', enabled: true },
        { pluginName: 'discord', enabled: false },
      ],
    });

    log('[e2e] Test data seeded successfully.');

    return {
      agentId: agent.id,
      projectId: project.id,
      generalThreadId: generalThread.id,
      cronThreadId: cronThread.id,
    };
  } finally {
    await prisma.$disconnect();
  }
};
