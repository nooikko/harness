import { describe, expect, it, vi } from 'vitest';

const mockFindUniqueOrThrow = vi.fn();
const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('database', () => ({
  prisma: {
    pluginConfig: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { togglePlugin } = await import('../toggle-plugin');

describe('togglePlugin', () => {
  it('disables an enabled plugin', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'pc_1',
      enabled: true,
    });
    mockUpdate.mockResolvedValue({});

    await togglePlugin('pc_1');

    expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'pc_1' },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'pc_1' },
      data: { enabled: false },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/plugins');
  });

  it('enables a disabled plugin', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'pc_2',
      enabled: false,
    });
    mockUpdate.mockResolvedValue({});

    await togglePlugin('pc_2');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'pc_2' },
      data: { enabled: true },
    });
  });
});
