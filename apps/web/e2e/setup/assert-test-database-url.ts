/**
 * Safety guard — ensures DATABASE_URL points to a local testcontainer,
 * not the live database. Call this before starting the E2E test server.
 *
 * Testcontainer URLs always use localhost/127.0.0.1 with a random port.
 * Any other host means we'd hit a real database.
 */
export const assertTestDatabaseUrl = (url: string): void => {
  if (!url) {
    throw new Error('DATABASE_URL is empty. E2E tests require a testcontainer database. Run via: pnpm --filter web test:e2e');
  }

  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  if (!isLocal) {
    throw new Error(
      `DATABASE_URL does not point to localhost — refusing to run E2E tests against a live database. Got: ${url.replace(/\/\/[^@]+@/, '//<redacted>@')}`,
    );
  }
};
