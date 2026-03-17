import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('encryptToken + decryptToken', () => {
  beforeEach(() => {
    // 32-byte key as hex (64 hex chars)
    vi.stubEnv('OAUTH_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  });

  it('encrypts and decrypts a token roundtrip', async () => {
    const { encryptToken } = await import('../encrypt-token');
    const { decryptToken } = await import('../decrypt-token');

    const original = 'my-secret-access-token-12345';
    const encrypted = encryptToken(original);

    expect(encrypted).not.toBe(original);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertexts for same input (random IV)', async () => {
    const { encryptToken } = await import('../encrypt-token');

    const token = 'same-token';
    const encrypted1 = encryptToken(token);
    const encrypted2 = encryptToken(token);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('throws if encryption key is not set', async () => {
    vi.stubEnv('OAUTH_ENCRYPTION_KEY', '');
    vi.resetModules();
    const { encryptToken } = await import('../encrypt-token');

    expect(() => encryptToken('test')).toThrow('OAUTH_ENCRYPTION_KEY must be set');
  });

  it('throws if encryption key is wrong length', async () => {
    vi.stubEnv('OAUTH_ENCRYPTION_KEY', 'aabbccdd'); // only 4 bytes
    vi.resetModules();
    const { encryptToken } = await import('../encrypt-token');

    expect(() => encryptToken('test')).toThrow('OAUTH_ENCRYPTION_KEY must be exactly 32 bytes');
  });

  it('throws on invalid ciphertext format', async () => {
    const { decryptToken } = await import('../decrypt-token');

    expect(() => decryptToken('not-valid-format')).toThrow('Invalid encrypted token format');
  });
});
