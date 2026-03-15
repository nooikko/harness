import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../env.js';

describe('loadEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads QDRANT_URL from environment', () => {
    vi.stubEnv('QDRANT_URL', 'http://localhost:6333');
    const env = loadEnv();
    expect(env.QDRANT_URL).toBe('http://localhost:6333');
  });
});
