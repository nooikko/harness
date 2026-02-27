import { describe, expect, it } from 'vitest';
import { decryptValue } from '../decrypt-value';
import { encryptValue } from '../encrypt-value';

const TEST_KEY = 'a'.repeat(64);

describe('decryptValue', () => {
  it('round-trips plaintext correctly', () => {
    const plaintext = 'my-secret-bot-token-xyz';
    const encrypted = encryptValue(plaintext, TEST_KEY);
    expect(decryptValue(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encryptValue('hello', TEST_KEY);
    const parts = encrypted.split(':');
    const tampered = `${parts[0]}:${parts[1]}:deadbeef`;
    expect(() => decryptValue(tampered, TEST_KEY)).toThrow();
  });

  it('throws on malformed format (not 3 parts)', () => {
    expect(() => decryptValue('only:two', TEST_KEY)).toThrow('Invalid ciphertext format');
  });

  it('throws if key is wrong length', () => {
    expect(() => decryptValue('a:b:c', 'tooshort')).toThrow('hex characters');
  });
});
