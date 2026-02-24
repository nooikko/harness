import { describe, expect, it, vi } from 'vitest';

const mockFindUniqueOrThrow = vi.fn();
const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('database', () => ({
  prisma: {
    cronJob: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { toggleCronJob } = await import('../toggle-cron-job');

describe('toggleCronJob', () => {
  it('disables an enabled cron job', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'cj_1',
      enabled: true,
    });
    mockUpdate.mockResolvedValue({});

    await toggleCronJob('cj_1');

    expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'cj_1' },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'cj_1' },
      data: { enabled: false },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/cron-jobs');
  });

  it('enables a disabled cron job', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'cj_2',
      enabled: false,
    });
    mockUpdate.mockResolvedValue({});

    await toggleCronJob('cj_2');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'cj_2' },
      data: { enabled: true },
    });
  });
});
