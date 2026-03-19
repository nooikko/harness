import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { stopTestDatabase } from './test-database';

const globalTeardown = async (): Promise<void> => {
  await stopTestDatabase();

  try {
    unlinkSync(join(process.cwd(), '.env.e2e'));
  } catch {
    // File may not exist if setup failed
  }
};

export default globalTeardown;
