import { describe, expect, it } from 'vitest';
import { encryptValue } from '../encrypt-value';

const TEST_KEY = 'a'.repeat(64); // 32 bytes as 64 hex chars

describe('encryptValue', () => {
  it('returns iv:tag:ciphertext format (3 colon-separated hex parts)', () => {
    const result = encryptValue('hello', TEST_KEY);
    const parts = result.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24); // 12-byte IV → 24 hex chars
    expect(parts[1]).toHaveLength(32); // 16-byte GCM tag → 32 hex chars
    expect(parts[2]!.length).toBeGreaterThan(0);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const a = encryptValue('hello', TEST_KEY);
    const b = encryptValue('hello', TEST_KEY);
    expect(a).not.toBe(b);
  });

  it('throws if key is wrong length', () => {
    expect(() => encryptValue('hello', 'tooshort')).toThrow('hex characters');
  });
});
