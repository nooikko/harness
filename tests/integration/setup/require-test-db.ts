/**
 * Returns TEST_DATABASE_URL or throws. Call this before creating any
 * PrismaClient in integration tests so we never accidentally connect
 * to the production database.
 */
export const requireTestDatabaseUrl = (): string => {
  // biome-ignore lint/complexity/useLiteralKeys: env access hook requires bracket notation
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Refusing to proceed — this would hit the production database. ' +
        'Run integration tests via: pnpm --filter integration-tests test:integration',
    );
  }
  return url;
};
