import { describe, expect, it } from 'vitest';
import { buildSettingsPayload } from '../build-settings-payload';

const TEST_KEY = 'a'.repeat(64); // 32-byte key as 64 hex chars

describe('buildSettingsPayload', () => {
  it('encrypts secret fields when encryption key is provided', () => {
    const fields = [
      { name: 'botToken', type: 'string', label: 'Bot Token', secret: true },
      { name: 'channelId', type: 'string', label: 'Channel ID' },
    ];
    const payload = buildSettingsPayload(fields, { botToken: 'my-secret', channelId: 'C123' }, TEST_KEY);

    expect(payload.channelId).toBe('C123');
    // encrypted: iv:tag:ciphertext — all hex segments
    expect(payload.botToken).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });

  it('passes non-secret fields through as-is', () => {
    const fields = [{ name: 'port', type: 'number', label: 'Port' }];
    const payload = buildSettingsPayload(fields, { port: '8080' }, TEST_KEY);
    expect(payload.port).toBe('8080');
  });

  it('skips fields with no value in formData', () => {
    const fields = [{ name: 'optional', type: 'string', label: 'Optional' }];
    const payload = buildSettingsPayload(fields, {}, TEST_KEY);
    expect(payload.optional).toBeUndefined();
  });

  it('passes secret field through as-is when encryptionKey is empty', () => {
    const fields = [{ name: 'token', type: 'string', label: 'Token', secret: true }];
    const payload = buildSettingsPayload(fields, { token: 'plaintext' }, '');
    expect(payload.token).toBe('plaintext');
  });

  it('skips empty secret field so existing encrypted value is preserved via merge', () => {
    const fields = [{ name: 'botToken', type: 'string', label: 'Bot Token', secret: true }];
    const payload = buildSettingsPayload(fields, { botToken: '' }, TEST_KEY);
    expect(payload.botToken).toBeUndefined();
  });
});
