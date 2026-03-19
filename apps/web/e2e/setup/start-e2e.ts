import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedTestData } from './seed-data';
import { startTestDatabase } from './test-database';

/**
 * E2E test entrypoint — starts testcontainer, seeds data,
 * then runs Playwright with DATABASE_URL set in the environment.
 *
 * This ensures the testcontainer is running BEFORE Playwright
 * starts its webServer (Next.js dev server).
 */
const run = async (): Promise<void> => {
  const databaseUrl = await startTestDatabase();
  await seedTestData(databaseUrl);

  // Write a marker file so teardown knows we started a container
  writeFileSync(join(process.cwd(), '.env.e2e'), databaseUrl);

  process.stdout.write('[e2e] Starting Playwright...\n');

  try {
    // Pass all original args through to Playwright
    const args = process.argv.slice(2).join(' ');
    execSync(`npx playwright test ${args}`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
  } finally {
    const { stopTestDatabase } = await import('./test-database');
    await stopTestDatabase();

    try {
      const { unlinkSync } = await import('node:fs');
      unlinkSync(join(process.cwd(), '.env.e2e'));
    } catch {
      // ignore
    }
  }
};

run().catch((err: unknown) => {
  process.stderr.write(`[e2e] Fatal: ${String(err)}\n`);
  process.exit(1);
});
