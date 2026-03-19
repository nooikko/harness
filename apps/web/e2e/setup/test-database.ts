import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer | null = null;

type Log = (message: string) => void;
const log: Log = (message) => process.stdout.write(`${message}\n`);

export const startTestDatabase = async (): Promise<string> => {
  log('[e2e] Starting Postgres testcontainer...');
  container = await new PostgreSqlContainer('postgres:16-alpine').start();

  const dbUrl = container.getConnectionUri();

  log('[e2e] Pushing Prisma schema...');
  const dbPackageDir = resolve(process.cwd(), '../../packages/database');
  execSync('pnpm prisma db push --skip-generate --accept-data-loss', {
    cwd: dbPackageDir,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
  });

  log('[e2e] Test database ready.');
  return dbUrl;
};

export const stopTestDatabase = async (): Promise<void> => {
  if (container) {
    log('[e2e] Stopping testcontainer...');
    await container.stop();
    container = null;
  }
};
