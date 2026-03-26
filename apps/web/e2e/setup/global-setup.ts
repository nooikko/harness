import { assertTestDatabaseUrl } from './assert-test-database-url';
import { seedTestData } from './seed-data';
import { startTestDatabase } from './test-database';

/**
 * Playwright globalSetup — runs BEFORE webServer starts.
 * Starts a Postgres testcontainer, pushes schema, seeds data,
 * and sets DATABASE_URL in process.env so the webServer inherits it.
 *
 * This ensures E2E tests NEVER hit the live database, regardless of
 * how Playwright is invoked (CLI, VS Code extension, start-e2e.ts).
 */
const globalSetup = async (): Promise<void> => {
  const databaseUrl = await startTestDatabase();

  // Safety guard — refuse to proceed if URL doesn't look like a testcontainer
  assertTestDatabaseUrl(databaseUrl);

  // Set in process.env so Playwright's webServer child process inherits it.
  // This is the critical line — Playwright spawns the webServer AFTER
  // globalSetup completes, and child processes inherit the parent's env.
  process.env.DATABASE_URL = databaseUrl;

  process.stdout.write(`[e2e] DATABASE_URL set to testcontainer (${databaseUrl.split('@')[1]?.split('/')[0] ?? 'unknown'})\n`);

  await seedTestData(databaseUrl);
};

export default globalSetup;
