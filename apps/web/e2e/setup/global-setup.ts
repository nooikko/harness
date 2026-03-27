/**
 * Playwright globalSetup — intentionally empty.
 * Database setup is handled by e2e/setup/start-e2e.ts which runs BEFORE
 * Playwright, writing .env.development.local so Next.js picks up the
 * testcontainer DATABASE_URL at startup.
 */
const globalSetup = async (): Promise<void> => {
  // No-op — DB setup done by start-e2e.ts
};

export default globalSetup;
