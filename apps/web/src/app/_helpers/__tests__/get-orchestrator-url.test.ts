import { afterEach, describe, expect, it } from 'vitest';

const { getOrchestratorUrl } = await import('../get-orchestrator-url');

describe('getOrchestratorUrl', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns the ORCHESTRATOR_URL env var when set', () => {
    process.env = { ...originalEnv, ORCHESTRATOR_URL: 'http://custom:9999' };
    expect(getOrchestratorUrl()).toBe('http://custom:9999');
  });

  it('returns default localhost:4001 when env var is not set', () => {
    process.env = { ...originalEnv };
    delete process.env.ORCHESTRATOR_URL;
    expect(getOrchestratorUrl()).toBe('http://localhost:4001');
  });
});
