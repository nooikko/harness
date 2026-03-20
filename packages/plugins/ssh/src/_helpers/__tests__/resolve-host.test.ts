import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/plugin-contract', () => ({
  decryptValue: vi.fn((ciphertext: string, _key: string) => `decrypted:${ciphertext}`),
  encryptValue: vi.fn((plaintext: string, _key: string) => `encrypted:${plaintext}`),
  createSettingsSchema: vi.fn((schema: unknown) => schema),
}));

import { resolveHost } from '../resolve-host';

const makeHost = (
  overrides: Partial<{
    id: string;
    name: string;
    hostname: string;
    port: number;
    username: string;
    authMethod: string;
    privateKey: string | null;
    fingerprint: string | null;
    enabled: boolean;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    lastSeenAt: Date | null;
  }> = {},
) => ({
  id: 'host-1',
  name: 'my-server',
  hostname: '192.168.1.100',
  port: 22,
  username: 'admin',
  authMethod: 'key',
  privateKey: null,
  fingerprint: null,
  enabled: true,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSeenAt: null,
  ...overrides,
});

const makeMockDb = (byName: ReturnType<typeof makeHost> | null, byId: ReturnType<typeof makeHost> | null = null) => ({
  sshHost: {
    findUnique: vi.fn().mockResolvedValueOnce(byName).mockResolvedValueOnce(byId),
  },
});

describe('resolveHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds host by name on first lookup', async () => {
    const host = makeHost({ name: 'my-server' });
    const db = makeMockDb(host);

    const result = await resolveHost({ db: db as never, nameOrId: 'my-server', encryptionKey: undefined });

    expect(db.sshHost.findUnique).toHaveBeenCalledWith({ where: { name: 'my-server' } });
    expect(result.name).toBe('my-server');
    expect(result.id).toBe('host-1');
  });

  it('falls back to find by ID when name lookup returns null', async () => {
    const host = makeHost({ id: 'host-abc', name: 'real-name' });
    const db = makeMockDb(null, host);

    const result = await resolveHost({ db: db as never, nameOrId: 'host-abc', encryptionKey: undefined });

    expect(db.sshHost.findUnique).toHaveBeenCalledTimes(2);
    expect(db.sshHost.findUnique).toHaveBeenNthCalledWith(2, { where: { id: 'host-abc' } });
    expect(result.id).toBe('host-abc');
  });

  it('throws if host not found by either name or ID', async () => {
    const db = makeMockDb(null, null);

    await expect(resolveHost({ db: db as never, nameOrId: 'ghost-host', encryptionKey: undefined })).rejects.toThrow(
      'SSH host "ghost-host" not found',
    );
  });

  it('throws if host is disabled', async () => {
    const host = makeHost({ enabled: false, name: 'disabled-server' });
    const db = makeMockDb(host);

    await expect(resolveHost({ db: db as never, nameOrId: 'disabled-server', encryptionKey: undefined })).rejects.toThrow(
      'SSH host "disabled-server" is disabled',
    );
  });

  it('decrypts private key when encryption key is provided', async () => {
    const { decryptValue } = await import('@harness/plugin-contract');
    const host = makeHost({ privateKey: 'encrypted-key-data' });
    const db = makeMockDb(host);

    const result = await resolveHost({
      db: db as never,
      nameOrId: 'my-server',
      encryptionKey: 'my-secret-key',
    });

    expect(decryptValue).toHaveBeenCalledWith('encrypted-key-data', 'my-secret-key');
    expect(result.privateKey).toBe('decrypted:encrypted-key-data');
  });

  it('throws if private key exists but no encryption key is provided', async () => {
    const host = makeHost({ privateKey: 'some-encrypted-key', name: 'secure-server' });
    const db = makeMockDb(host);

    await expect(resolveHost({ db: db as never, nameOrId: 'secure-server', encryptionKey: undefined })).rejects.toThrow(
      'Cannot decrypt private key for "secure-server"',
    );
  });

  it('returns null privateKey when no private key is stored on the host', async () => {
    const host = makeHost({ privateKey: null });
    const db = makeMockDb(host);

    const result = await resolveHost({ db: db as never, nameOrId: 'my-server', encryptionKey: 'any-key' });

    expect(result.privateKey).toBeNull();
  });

  it('returns all expected fields from the resolved host', async () => {
    const host = makeHost({
      id: 'host-xyz',
      name: 'web-server',
      hostname: '10.0.0.5',
      port: 2222,
      username: 'deploy',
      authMethod: 'password',
      fingerprint: 'abc123',
      enabled: true,
    });
    const db = makeMockDb(host);

    const result = await resolveHost({ db: db as never, nameOrId: 'web-server', encryptionKey: undefined });

    expect(result).toMatchObject({
      id: 'host-xyz',
      name: 'web-server',
      hostname: '10.0.0.5',
      port: 2222,
      username: 'deploy',
      authMethod: 'password',
      fingerprint: 'abc123',
      enabled: true,
      privateKey: null,
    });
  });
});
