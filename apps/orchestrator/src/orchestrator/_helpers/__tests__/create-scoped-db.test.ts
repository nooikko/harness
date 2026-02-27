import type { PrismaClient } from 'database';
import { describe, expect, it, vi } from 'vitest';
import { createScopedDb } from '../create-scoped-db';

describe('createScopedDb', () => {
  it('calls db.$extends and returns the result', () => {
    const extendedDb = { pluginConfig: { findUnique: vi.fn() } };
    const mockDb = {
      $extends: vi.fn().mockReturnValue(extendedDb),
    } as unknown as PrismaClient;

    const result = createScopedDb(mockDb, 'discord');

    expect(mockDb.$extends).toHaveBeenCalledOnce();
    expect(result).toBe(extendedDb);
  });

  it('findUnique interceptor injects pluginName into where clause', async () => {
    let capturedExtension: Record<string, unknown> = {};
    const mockDb = {
      $extends: vi.fn().mockImplementation((ext: Record<string, unknown>) => {
        capturedExtension = ext;
        return mockDb;
      }),
    } as unknown as PrismaClient;

    createScopedDb(mockDb, 'discord');

    const query = vi.fn().mockResolvedValue({ id: '1' });
    const interceptors = capturedExtension.query as Record<
      string,
      Record<string, (opts: { args: Record<string, unknown>; query: typeof query }) => Promise<unknown>>
    >;
    const result = await interceptors['pluginConfig']?.['findUnique']?.({
      args: { where: {} },
      query,
    });

    expect(query).toHaveBeenCalledWith({
      where: { pluginName: 'discord' },
    });
    expect(result).toEqual({ id: '1' });
  });

  it('upsert interceptor injects pluginName into where and create', async () => {
    let capturedExtension: Record<string, unknown> = {};
    const mockDb = {
      $extends: vi.fn().mockImplementation((ext: Record<string, unknown>) => {
        capturedExtension = ext;
        return mockDb;
      }),
    } as unknown as PrismaClient;

    createScopedDb(mockDb, 'web');

    const query = vi.fn().mockResolvedValue({ id: '2' });
    const interceptors = capturedExtension.query as Record<
      string,
      Record<string, (opts: { args: Record<string, unknown>; query: typeof query }) => Promise<unknown>>
    >;
    const result = await interceptors['pluginConfig']?.['upsert']?.({
      args: {
        where: {},
        create: { enabled: true, settings: {} },
        update: { settings: {} },
      },
      query,
    });

    expect(query).toHaveBeenCalledWith({
      where: { pluginName: 'web' },
      create: { enabled: true, settings: {}, pluginName: 'web' },
      update: { settings: {} },
    });
    expect(result).toEqual({ id: '2' });
  });

  it('update interceptor injects pluginName into where clause', async () => {
    let capturedExtension: Record<string, unknown> = {};
    const mockDb = {
      $extends: vi.fn().mockImplementation((ext: Record<string, unknown>) => {
        capturedExtension = ext;
        return mockDb;
      }),
    } as unknown as PrismaClient;

    createScopedDb(mockDb, 'metrics');

    const query = vi.fn().mockResolvedValue({ id: '3' });
    const interceptors = capturedExtension.query as Record<
      string,
      Record<string, (opts: { args: Record<string, unknown>; query: typeof query }) => Promise<unknown>>
    >;
    const result = await interceptors['pluginConfig']?.['update']?.({
      args: { where: {}, data: { settings: {} } },
      query,
    });

    expect(query).toHaveBeenCalledWith({
      where: { pluginName: 'metrics' },
      data: { settings: {} },
    });
    expect(result).toEqual({ id: '3' });
  });
});
