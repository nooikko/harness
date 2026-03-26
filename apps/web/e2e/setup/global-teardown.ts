import { stopTestDatabase } from './test-database';

/**
 * Playwright globalTeardown — stops the testcontainer after all tests complete.
 */
const globalTeardown = async (): Promise<void> => {
  await stopTestDatabase();
};

export default globalTeardown;
