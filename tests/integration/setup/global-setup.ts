import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;

export const setup = async (): Promise<() => Promise<void>> => {
  console.log('[integration] Starting Postgres testcontainer...');
  container = await new PostgreSqlContainer('postgres:16-alpine').start();

  const dbUrl = container.getConnectionUri();
  process.env.TEST_DATABASE_URL = dbUrl;

  console.log('[integration] Pushing Prisma schema...');
  const dbPackageDir = resolve(process.cwd(), '../../packages/database');
  execSync('pnpm prisma db push --skip-generate --accept-data-loss', {
    cwd: dbPackageDir,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
  });

  console.log('[integration] Test database ready.');

  return async (): Promise<void> => {
    console.log('[integration] Stopping testcontainer...');
    await container.stop();
  };
};
