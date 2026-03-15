import { afterEach, describe, expect, it, vi } from 'vitest';

const mockInstances: Array<{ url: string }> = [];

vi.mock('@qdrant/js-client-rest', () => {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class MockQdrantClient {
    url: string;
    constructor(opts: { url: string }) {
      this.url = opts.url;
      mockInstances.push(this);
    }
  }
  return { QdrantClient: MockQdrantClient };
});

vi.mock('../../env.js', () => ({
  loadEnv: vi.fn(),
}));

describe('getQdrantClient', () => {
  afterEach(() => {
    mockInstances.length = 0;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns null when QDRANT_URL is not set', async () => {
    const { loadEnv } = await import('../../env.js');
    vi.mocked(loadEnv).mockReturnValue({});

    const { getQdrantClient } = await import('../qdrant-client.js');
    const client = getQdrantClient();

    expect(client).toBeNull();
    expect(mockInstances).toHaveLength(0);
  });

  it('returns a QdrantClient when QDRANT_URL is set', async () => {
    const { loadEnv } = await import('../../env.js');
    vi.mocked(loadEnv).mockReturnValue({ QDRANT_URL: 'http://localhost:6333' });

    const { getQdrantClient } = await import('../qdrant-client.js');
    const client = getQdrantClient();

    expect(client).not.toBeNull();
    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]?.url).toBe('http://localhost:6333');
  });

  it('returns the same singleton instance on subsequent calls', async () => {
    const { loadEnv } = await import('../../env.js');
    vi.mocked(loadEnv).mockReturnValue({ QDRANT_URL: 'http://localhost:6333' });

    const { getQdrantClient } = await import('../qdrant-client.js');
    const first = getQdrantClient();
    const second = getQdrantClient();

    expect(first).toBe(second);
    expect(mockInstances).toHaveLength(1);
  });
});
