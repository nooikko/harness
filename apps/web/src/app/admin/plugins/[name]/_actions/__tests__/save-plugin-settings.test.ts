import { describe, expect, it, vi } from 'vitest';
import { buildSettingsPayload } from '../save-plugin-settings';

const TEST_KEY = 'a'.repeat(64); // 32-byte key as 64 hex chars

const mockUpsert = vi.fn();
const mockRevalidatePath = vi.fn();
const mockFetch = vi.fn();

vi.mock('database', () => ({
  prisma: {
    pluginConfig: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.stubGlobal('fetch', mockFetch);

vi.mock('@/generated/plugin-settings-registry', () => ({
  pluginSettingsRegistry: [
    {
      pluginName: 'discord',
      fields: [
        { name: 'botToken', type: 'string', label: 'Bot Token', secret: true },
        { name: 'channelId', type: 'string', label: 'Channel ID' },
      ],
    },
  ],
}));

const { savePluginSettings } = await import('../save-plugin-settings');

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

  it('stores empty string as-is for secret field (empty string means clear the field)', () => {
    const fields = [{ name: 'botToken', type: 'string', label: 'Bot Token', secret: true }];
    const payload = buildSettingsPayload(fields, { botToken: '' }, TEST_KEY);
    expect(payload.botToken).toBe('');
  });
});

describe('savePluginSettings', () => {
  it('upserts settings and revalidates path on success', async () => {
    mockUpsert.mockResolvedValue({});
    mockFetch.mockResolvedValue({ ok: true });

    const result = await savePluginSettings('discord', { botToken: 'tok', channelId: 'C1' });

    expect(result).toEqual({ success: true });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { pluginName: 'discord' },
      create: expect.objectContaining({ pluginName: 'discord', enabled: true }),
      update: expect.objectContaining({}),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/plugins/discord');
  });

  it('swallows orchestrator fetch failures and still returns success', async () => {
    mockUpsert.mockResolvedValue({});
    mockFetch.mockRejectedValue(new Error('connection refused'));

    const result = await savePluginSettings('discord', { channelId: 'C2' });

    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/plugins/discord');
  });

  it('returns error when prisma upsert fails', async () => {
    mockUpsert.mockRejectedValue(new Error('DB error'));

    const result = await savePluginSettings('discord', { channelId: 'C3' });

    expect(result).toEqual({ success: false, error: 'DB error' });
  });

  it('uses empty fields when plugin is not in registry', async () => {
    mockUpsert.mockResolvedValue({});
    mockFetch.mockResolvedValue({ ok: true });

    const result = await savePluginSettings('unknown-plugin', { foo: 'bar' });

    expect(result).toEqual({ success: true });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { pluginName: 'unknown-plugin' },
      create: { pluginName: 'unknown-plugin', enabled: true, settings: {} },
      update: { settings: {} },
    });
  });
});
