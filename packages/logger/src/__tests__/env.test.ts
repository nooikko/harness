import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('loadLoggerEnv', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads LOG_FILE when set', async () => {
    vi.stubEnv('LOG_FILE', '/tmp/test.log');
    const { loadLoggerEnv } = await import('../env');
    const env = loadLoggerEnv();
    expect(env.LOG_FILE).toBe('/tmp/test.log');
  });

  it('reads LOG_LEVEL when set', async () => {
    vi.stubEnv('LOG_LEVEL', 'debug');
    const { loadLoggerEnv } = await import('../env');
    const env = loadLoggerEnv();
    expect(env.LOG_LEVEL).toBe('debug');
  });

  it('reads NODE_ENV when set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { loadLoggerEnv } = await import('../env');
    const env = loadLoggerEnv();
    expect(env.NODE_ENV).toBe('production');
  });
});
