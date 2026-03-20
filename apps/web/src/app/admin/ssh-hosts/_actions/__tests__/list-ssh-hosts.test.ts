import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    sshHost: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { listSshHosts } = await import('../list-ssh-hosts');

const makeHost = (overrides: Record<string, unknown> = {}) => ({
  id: 'host-1',
  name: 'My Server',
  hostname: 'example.com',
  port: 22,
  username: 'admin',
  authMethod: 'key',
  fingerprint: null,
  tags: [],
  enabled: true,
  lastSeenAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

describe('listSshHosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the list of hosts', async () => {
    const hosts = [makeHost({ id: 'host-1', name: 'Alpha' }), makeHost({ id: 'host-2', name: 'Beta' })];
    mockFindMany.mockResolvedValue(hosts);

    const result = await listSshHosts();

    expect(result).toEqual(hosts);
  });

  it('returns an empty array when no hosts exist', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await listSshHosts();

    expect(result).toEqual([]);
  });

  it('queries with the correct select fields excluding privateKey', async () => {
    mockFindMany.mockResolvedValue([]);

    await listSshHosts();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          name: true,
          hostname: true,
          port: true,
          username: true,
          authMethod: true,
          fingerprint: true,
          tags: true,
          enabled: true,
          lastSeenAt: true,
          createdAt: true,
          updatedAt: true,
        }),
      }),
    );
  });

  it('does not include privateKey in the select clause', async () => {
    mockFindMany.mockResolvedValue([]);

    await listSshHosts();

    const callArg = mockFindMany.mock.calls[0]?.[0] as { select?: Record<string, unknown> };
    expect(callArg?.select).not.toHaveProperty('privateKey');
  });

  it('orders results by name ascending', async () => {
    mockFindMany.mockResolvedValue([]);

    await listSshHosts();

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { name: 'asc' } }));
  });

  it('includes hosts with a fingerprint', async () => {
    const host = makeHost({ fingerprint: 'SHA256:abc123' });
    mockFindMany.mockResolvedValue([host]);

    const result = await listSshHosts();

    expect(result[0]?.fingerprint).toBe('SHA256:abc123');
  });

  it('includes disabled hosts', async () => {
    const host = makeHost({ enabled: false });
    mockFindMany.mockResolvedValue([host]);

    const result = await listSshHosts();

    expect(result[0]?.enabled).toBe(false);
  });
});
