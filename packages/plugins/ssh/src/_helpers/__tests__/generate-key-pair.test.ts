import { describe, expect, it } from 'vitest';
import { generateKeyPair } from '../generate-key-pair';

describe('generateKeyPair', () => {
  it('returns an object with privateKey and publicKey string properties', () => {
    const result = generateKeyPair();
    expect(result).toHaveProperty('privateKey');
    expect(result).toHaveProperty('publicKey');
    expect(typeof result.privateKey).toBe('string');
    expect(typeof result.publicKey).toBe('string');
  });

  it('privateKey starts with PEM header for PKCS8 format', () => {
    const result = generateKeyPair();
    expect(result.privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----/); // gitleaks:allow
  });

  it('privateKey ends with PEM footer', () => {
    const result = generateKeyPair();
    expect(result.privateKey).toMatch(/-----END PRIVATE KEY-----/);
  });

  it('publicKey starts with ssh-ed25519 prefix for OpenSSH format', () => {
    const result = generateKeyPair();
    expect(result.publicKey).toMatch(/^ssh-ed25519 /);
  });

  it('publicKey contains a base64-encoded key after the prefix', () => {
    const result = generateKeyPair();
    const parts = result.publicKey.split(' ');
    expect(parts.length).toBeGreaterThanOrEqual(2);
    const base64Part = parts[1];
    // Valid base64 characters only
    expect(base64Part).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('generates unique key pairs on each call', () => {
    const first = generateKeyPair();
    const second = generateKeyPair();
    expect(first.privateKey).not.toBe(second.privateKey);
    expect(first.publicKey).not.toBe(second.publicKey);
  });

  it('privateKey is non-empty', () => {
    const result = generateKeyPair();
    expect(result.privateKey.length).toBeGreaterThan(0);
  });

  it('publicKey is non-empty', () => {
    const result = generateKeyPair();
    expect(result.publicKey.length).toBeGreaterThan(0);
  });
});
