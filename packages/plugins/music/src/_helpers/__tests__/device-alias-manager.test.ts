import { describe, expect, it, vi } from 'vitest';
import { getDeviceAliases, setDeviceAlias } from '../device-alias-manager';

describe('device-alias-manager', () => {
  describe('getDeviceAliases', () => {
    it('returns device aliases from settings', () => {
      const settings = {
        deviceAliases: { 'dev-1': 'Kitchen', 'dev-2': 'Living Room' },
      };
      const aliases = getDeviceAliases(settings);
      expect(aliases).toEqual({ 'dev-1': 'Kitchen', 'dev-2': 'Living Room' });
    });

    it('returns empty object when deviceAliases is undefined', () => {
      const settings = {};
      const aliases = getDeviceAliases(settings);
      expect(aliases).toEqual({});
    });

    it('returns empty object when deviceAliases is null-ish', () => {
      const settings = { deviceAliases: undefined };
      const aliases = getDeviceAliases(settings);
      expect(aliases).toEqual({});
    });
  });

  describe('setDeviceAlias', () => {
    it('creates PluginConfig when none exists', async () => {
      const pluginConfig = {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
      };
      const mockDb = {
        pluginConfig,
        $transaction: vi.fn((cb: (tx: { pluginConfig: typeof pluginConfig }) => Promise<unknown>) => cb({ pluginConfig })),
      };
      const ctx = { db: mockDb } as unknown as Parameters<typeof setDeviceAlias>[0];

      await setDeviceAlias(ctx, 'dev-1', 'Kitchen');

      expect(mockDb.pluginConfig.upsert).toHaveBeenCalledWith({
        where: { pluginName: 'music' },
        create: expect.objectContaining({
          pluginName: 'music',
          enabled: true,
          settings: { deviceAliases: { 'dev-1': 'Kitchen' } },
        }),
        update: expect.objectContaining({
          settings: { deviceAliases: { 'dev-1': 'Kitchen' } },
        }),
      });
    });

    it('merges with existing aliases', async () => {
      const pluginConfig = {
        findUnique: vi.fn().mockResolvedValue({
          settings: { deviceAliases: { 'dev-1': 'Old Name' }, defaultVolume: 75 },
        }),
        upsert: vi.fn().mockResolvedValue({}),
      };
      const mockDb = {
        pluginConfig,
        $transaction: vi.fn((cb: (tx: { pluginConfig: typeof pluginConfig }) => Promise<unknown>) => cb({ pluginConfig })),
      };
      const ctx = { db: mockDb } as unknown as Parameters<typeof setDeviceAlias>[0];

      await setDeviceAlias(ctx, 'dev-2', 'Bedroom');

      expect(mockDb.pluginConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            settings: {
              defaultVolume: 75,
              deviceAliases: { 'dev-1': 'Old Name', 'dev-2': 'Bedroom' },
            },
          },
        }),
      );
    });

    it('overwrites existing alias for same device', async () => {
      const pluginConfig = {
        findUnique: vi.fn().mockResolvedValue({
          settings: { deviceAliases: { 'dev-1': 'Old Name' } },
        }),
        upsert: vi.fn().mockResolvedValue({}),
      };
      const mockDb = {
        pluginConfig,
        $transaction: vi.fn((cb: (tx: { pluginConfig: typeof pluginConfig }) => Promise<unknown>) => cb({ pluginConfig })),
      };
      const ctx = { db: mockDb } as unknown as Parameters<typeof setDeviceAlias>[0];

      await setDeviceAlias(ctx, 'dev-1', 'New Name');

      expect(mockDb.pluginConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            settings: { deviceAliases: { 'dev-1': 'New Name' } },
          },
        }),
      );
    });
  });
});
