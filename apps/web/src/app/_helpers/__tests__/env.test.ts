import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('loadEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.UPLOAD_DIR;
    delete process.env.MAX_FILE_SIZE_MB;
    delete process.env.ORCHESTRATOR_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const loadFresh = async () => {
    const mod = await import('../env');
    return mod.loadEnv();
  };

  it('returns defaults when env vars are unset', async () => {
    const env = await loadFresh();

    expect(env.UPLOAD_DIR).toBe('./uploads');
    expect(env.MAX_FILE_SIZE_MB).toBe(10);
    expect(env.ORCHESTRATOR_URL).toBe('http://localhost:4001');
  });

  it('reads values from env vars when set', async () => {
    process.env.UPLOAD_DIR = '/data/files';
    process.env.MAX_FILE_SIZE_MB = '25';
    process.env.ORCHESTRATOR_URL = 'http://orch:5000';

    const env = await loadFresh();

    expect(env.UPLOAD_DIR).toBe('/data/files');
    expect(env.MAX_FILE_SIZE_MB).toBe(25);
    expect(env.ORCHESTRATOR_URL).toBe('http://orch:5000');
  });
});
