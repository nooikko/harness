import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedTestData } from './seed-data';
import { startTestDatabase } from './test-database';

/**
 * Playwright globalSetup — runs BEFORE webServer starts.
 * Starts a Postgres testcontainer, pushes schema, seeds data,
 * and writes DATABASE_URL to .env.e2e for the webServer to source.
 *
 * Playwright runs this from apps/web/ as cwd, and the webServer command
 * also runs from apps/web/, so we use process.cwd() for consistency.
 */
const globalSetup = async (): Promise<void> => {
  const databaseUrl = await startTestDatabase();

  // Write .env.e2e to apps/web/ — webServer's `source .env.e2e` reads from its cwd
  const envFilePath = join(process.cwd(), '.env.e2e');
  writeFileSync(envFilePath, `export DATABASE_URL="${databaseUrl}"\n`);

  process.stdout.write(`[e2e] Wrote DATABASE_URL to ${envFilePath}\n`);

  await seedTestData(databaseUrl);
};

export default globalSetup;
