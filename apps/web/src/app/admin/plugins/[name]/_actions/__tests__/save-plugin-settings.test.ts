import { describe, expect, it, vi } from 'vitest';

const mockUpsert = vi.fn();
const mockFindUnique = vi.fn();
const mockRevalidatePath = vi.fn();
const mockFetch = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    pluginConfig: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
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

describe('savePluginSettings', () => {
  it('upserts settings and revalidates path on success', async () => {
    mockFindUnique.mockResolvedValue(null);
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
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});
    mockFetch.mockRejectedValue(new Error('connection refused'));

    const result = await savePluginSettings('discord', { channelId: 'C2' });

    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/plugins/discord');
  });

  it('returns error when prisma upsert fails', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockRejectedValue(new Error('DB error'));

    const result = await savePluginSettings('discord', { channelId: 'C3' });

    expect(result).toEqual({ success: false, error: 'DB error' });
  });

  it('uses empty fields when plugin is not in registry', async () => {
    mockFindUnique.mockResolvedValue(null);
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

  it('preserves existing encrypted secret when submitted value is empty', async () => {
    mockFindUnique.mockResolvedValue({
      pluginName: 'discord',
      enabled: true,
      settings: { botToken: 'encrypted:existing:value', channelId: 'C42' },
    });
    mockUpsert.mockResolvedValue({});
    mockFetch.mockResolvedValue({ ok: true });

    // User submits with empty botToken (did not retype) and updated channelId
    await savePluginSettings('discord', { botToken: '', channelId: 'C99' });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          settings: { botToken: 'encrypted:existing:value', channelId: 'C99' },
        }),
      }),
    );
  });
});
