import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('decryptToken', () => {
  beforeEach(() => {
    vi.stubEnv('OAUTH_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  });

  it('decrypts a token encrypted by encryptToken', async () => {
    const { encryptToken } = await import('../encrypt-token');
    const { decryptToken } = await import('../decrypt-token');

    const encrypted = encryptToken('my-secret-token');
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe('my-secret-token');
  });

  it('throws on invalid ciphertext format', async () => {
    const { decryptToken } = await import('../decrypt-token');

    expect(() => decryptToken('only-one-part')).toThrow('Invalid encrypted token format');
  });

  it('throws on tampered ciphertext', async () => {
    const { encryptToken } = await import('../encrypt-token');
    const { decryptToken } = await import('../decrypt-token');

    const encrypted = encryptToken('secret');
    const parts = encrypted.split(':');
    // Tamper with the ciphertext
    parts[2] = 'AAAA';
    const tampered = parts.join(':');

    expect(() => decryptToken(tampered)).toThrow();
  });
});
