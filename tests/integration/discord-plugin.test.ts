import { plugin as discordPlugin, splitMessage } from '@harness/plugin-discord';
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
    await expect(
      createTestHarness(discordPlugin).then((h) => {
        harness = h;
        return h;
      }),
    ).resolves.toBeDefined();
  });

  it('has correct name and version', () => {
    expect(discordPlugin.name).toBe('discord');
    expect(discordPlugin.version).toBe('1.0.0');
  });

  it('splitMessage returns a single chunk for short messages', () => {
    const result = splitMessage('Hello world');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Hello world');
  });

  it('splitMessage splits messages over 2000 characters into multiple chunks', () => {
    const longMessage = 'x'.repeat(2001);
    const result = splitMessage(longMessage);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(2000);
    }
    expect(result.join('')).toBe(longMessage);
  });
});
