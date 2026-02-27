import { createSettingsSchema } from '@harness/plugin-contract';
import type { PrismaClient } from 'database';
import { describe, expect, it, vi } from 'vitest';
import { getPluginSettings } from '../get-plugin-settings';

const schema = createSettingsSchema({
  botToken: { type: 'string' as const, label: 'Bot Token', secret: true },
  channelId: { type: 'string' as const, label: 'Channel ID' },
});

describe('getPluginSettings', () => {
  it('returns plaintext settings from DB', async () => {
    const mockDb = {
      pluginConfig: {
        findUnique: vi.fn().mockResolvedValue({
          pluginName: 'discord',
          settings: { botToken: 'plain-token', channelId: 'C123' },
          enabled: true,
        }),
      },
    } as unknown as PrismaClient;

    const settings = await getPluginSettings(mockDb, 'discord', schema);
    expect(settings.channelId).toBe('C123');
    expect(settings.botToken).toBe('plain-token');
  });

  it('returns empty object when no config row exists', async () => {
    const mockDb = {
      pluginConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;

    const settings = await getPluginSettings(mockDb, 'discord', schema);
    expect(settings).toEqual({});
  });

  it('skips fields with null/undefined values', async () => {
    const mockDb = {
      pluginConfig: {
        findUnique: vi.fn().mockResolvedValue({ settings: { channelId: 'C123' } }),
      },
    } as unknown as PrismaClient;

    const settings = await getPluginSettings(mockDb, 'discord', schema);
    expect(settings.channelId).toBe('C123');
    expect(settings.botToken).toBeUndefined();
  });
});
