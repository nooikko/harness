import { plugin as discordPlugin } from '@harness/plugin-discord';
import { PrismaClient } from 'database';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env['TEST_DATABASE_URL'] });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('discord plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('registers and starts without throwing when discordToken is undefined', async () => {
    // The discord plugin logs a warning and skips gateway connection when no token is set.
    // This verifies the graceful degradation path exercised through the real orchestrator
    // registerPlugin → start lifecycle. A regression here (plugin throwing instead of warning)
    // would break the entire orchestrator startup since all plugins register at boot.
    await expect(
      createTestHarness(discordPlugin).then((h) => {
        harness = h;
        return h;
      }),
    ).resolves.toBeDefined();
  });
});
