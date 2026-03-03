import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDelete = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    cronJob: {
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { deleteCronJob } = await import('../delete-cron-job');

describe('deleteCronJob', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns success on a valid delete', async () => {
    mockDelete.mockResolvedValue({});

    const result = await deleteCronJob('cj_1');

    expect(result).toEqual({ success: true });
  });

  it('calls prisma.cronJob.delete with the correct where clause', async () => {
    mockDelete.mockResolvedValue({});

    await deleteCronJob('cj_target');

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'cj_target' } });
  });

  it('calls revalidatePath on success', async () => {
    mockDelete.mockResolvedValue({});

    await deleteCronJob('cj_1');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/cron-jobs');
  });

  it('returns error when prisma throws', async () => {
    mockDelete.mockRejectedValue(new Error('Record not found'));

    const result = await deleteCronJob('cj_missing');

    expect(result).toEqual({ error: 'Failed to delete cron job' });
  });

  it('does not call revalidatePath when prisma throws', async () => {
    mockDelete.mockRejectedValue(new Error('Record not found'));

    await deleteCronJob('cj_missing');

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
