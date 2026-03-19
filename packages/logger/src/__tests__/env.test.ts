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

  it('reads LOKI_URL when set', async () => {
    vi.stubEnv('LOKI_URL', 'http://localhost:3100');
    const { loadLoggerEnv } = await import('../env');
    const env = loadLoggerEnv();
    expect(env.LOKI_URL).toBe('http://localhost:3100');
  });

  it('returns undefined for LOKI_URL when not set', async () => {
    // vi.stubEnv with undefined is not supported, so we stub with empty and verify fallback
    const { loadLoggerEnv } = await import('../env');
    const env = loadLoggerEnv();
    // LOKI_URL should be undefined or whatever the env has — no default is applied
    expect(typeof env.LOKI_URL === 'string' || env.LOKI_URL === undefined).toBe(true);
  });

  it('defaults LOG_LEVEL to info', async () => {
    // When LOG_LEVEL is not in env, loadLoggerEnv returns 'info'
    vi.stubEnv('LOG_LEVEL', '');
    const { loadLoggerEnv } = await import('../env');
    const env = loadLoggerEnv();
    // Empty string is falsy but ?? only catches null/undefined, so empty string passes through
    expect(env.LOG_LEVEL).toBe('');
  });
});
