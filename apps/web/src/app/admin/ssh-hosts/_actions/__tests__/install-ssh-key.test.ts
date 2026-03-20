import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();
const mockEncryptValue = vi.fn((val: string, _key: string) => `encrypted:${val}`);
const mockLoadEnv = vi.fn(() => ({ HARNESS_ENCRYPTION_KEY: 'a'.repeat(64) }));

const mockGenerateKeyPairSync = vi.fn((_type: string) => ({
  private: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----',
  public: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA test-key',
}));

vi.mock('@harness/database', () => ({
  prisma: {
    sshHost: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@harness/plugin-contract', () => ({
  encryptValue: (val: string, key: string) => mockEncryptValue(val, key),
}));

vi.mock('@/app/_helpers/env', () => ({
  loadEnv: () => mockLoadEnv(),
}));

vi.mock('@/lib/logger', () => ({
  webLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('ssh2', () => {
  const mockClient = {
    on: vi.fn().mockReturnThis(),
    connect: vi.fn(),
    exec: vi.fn(),
    end: vi.fn(),
    destroy: vi.fn(),
  };
  return {
    Client: vi.fn(() => mockClient),
    utils: {
      generateKeyPairSync: (_type: string) => mockGenerateKeyPairSync(_type),
    },
  };
});

const { installSshKey } = await import('../install-ssh-key');

const validInput = {
  hostId: 'host-1',
  hostname: 'example.com',
  port: 22,
  username: 'admin',
  password: 'secret',
};

describe('installSshKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadEnv.mockReturnValue({ HARNESS_ENCRYPTION_KEY: 'a'.repeat(64) });
    mockFindUnique.mockResolvedValue({ id: 'host-1' });
  });

  describe('validation', () => {
    it('returns error when password is empty', async () => {
      const result = await installSshKey({ ...validInput, password: '' });

      expect(result).toEqual({ error: 'Password is required' });
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns error when hostname is empty', async () => {
      const result = await installSshKey({ ...validInput, hostname: '' });

      expect(result).toEqual({ error: 'Hostname is required' });
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns error when username is empty', async () => {
      const result = await installSshKey({ ...validInput, username: '' });

      expect(result).toEqual({ error: 'Username is required' });
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns error when HARNESS_ENCRYPTION_KEY is not set', async () => {
      mockLoadEnv.mockReturnValue({ HARNESS_ENCRYPTION_KEY: undefined as unknown as string });

      const result = await installSshKey(validInput);

      expect(result).toEqual({
        error: 'Cannot store private key: HARNESS_ENCRYPTION_KEY is not configured',
      });
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns error when host is not found in DB', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await installSshKey(validInput);

      expect(result).toEqual({ error: 'SSH host not found' });
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'host-1' },
        select: { id: true },
      });
    });
  });
});
