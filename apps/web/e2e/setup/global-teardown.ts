/**
 * Playwright globalTeardown — intentionally empty.
 * Cleanup is handled by e2e/setup/start-e2e.ts after Playwright exits.
 */
const globalTeardown = async (): Promise<void> => {
  // No-op — cleanup done by start-e2e.ts
};

export default globalTeardown;
