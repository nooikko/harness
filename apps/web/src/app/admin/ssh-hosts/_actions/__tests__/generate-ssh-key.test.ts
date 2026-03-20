import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateKeyPairSync = vi.fn((_type: string) => ({
  private: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----', // gitleaks:allow
  public: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA test-key',
}));

vi.mock('ssh2', () => ({
  utils: {
    generateKeyPairSync: (type: string) => mockGenerateKeyPairSync(type),
  },
}));

const { generateSshKey } = await import('../generate-ssh-key');

describe('generateSshKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateKeyPairSync.mockReturnValue({
      private: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----', // gitleaks:allow
      public: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA test-key',
    });
  });

  it('returns success with privateKey and publicKey', async () => {
    const result = await generateSshKey();

    expect(result).toEqual({
      success: true,
      privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----', // gitleaks:allow
      publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA test-key',
    });
  });

  it('generates an ed25519 key pair', async () => {
    await generateSshKey();

    expect(mockGenerateKeyPairSync).toHaveBeenCalledWith('ed25519');
  });

  it('public key starts with ssh-ed25519', async () => {
    const result = await generateSshKey();

    if ('success' in result) {
      expect(result.publicKey).toMatch(/^ssh-ed25519 /);
    }
  });

  it('private key contains PEM header', async () => {
    const result = await generateSshKey();

    if ('success' in result) {
      expect(result.privateKey).toContain('-----BEGIN OPENSSH PRIVATE KEY-----');
    }
  });

  it('returns error when ssh2 throws', async () => {
    mockGenerateKeyPairSync.mockImplementation(() => {
      throw new Error('Key generation failed internally');
    });

    const result = await generateSshKey();

    expect(result).toEqual({
      error: 'Key generation failed: Key generation failed internally',
    });
  });

  it('returns error with non-Error throws as string', async () => {
    mockGenerateKeyPairSync.mockImplementation(() => {
      throw 'some string error';
    });

    const result = await generateSshKey();

    expect(result).toMatchObject({ error: expect.stringContaining('Key generation failed:') });
  });
});
