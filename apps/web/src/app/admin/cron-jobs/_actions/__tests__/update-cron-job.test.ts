import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    cronJob: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { updateCronJob } = await import('../update-cron-job');

describe('updateCronJob', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns success on a valid update', async () => {
    mockUpdate.mockResolvedValue({});

    const result = await updateCronJob({
      id: 'cj_1',
      name: 'Updated Name',
      prompt: 'Updated prompt.',
    });

    expect(result).toEqual({ success: true });
  });

  it('calls revalidatePath on success', async () => {
    mockUpdate.mockResolvedValue({});

    await updateCronJob({ id: 'cj_1', enabled: false });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/cron-jobs');
  });

  it('returns error when both schedule and fireAt are provided and both are set', async () => {
    const result = await updateCronJob({
      id: 'cj_1',
      schedule: '0 9 * * *',
      fireAt: '2026-04-01T10:00:00.000Z',
    });

    expect(result).toEqual({
      error: 'Exactly one of schedule or fireAt must be set, not both',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns error when both schedule and fireAt are provided and both are falsy', async () => {
    const result = await updateCronJob({
      id: 'cj_1',
      schedule: null,
      fireAt: null,
    });

    expect(result).toEqual({
      error: 'Exactly one of schedule or fireAt must be set, not both',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns success when only schedule is provided (fireAt absent)', async () => {
    mockUpdate.mockResolvedValue({});

    const result = await updateCronJob({
      id: 'cj_1',
      schedule: '0 9 * * *',
    });

    expect(result).toEqual({ success: true });
  });

  it('returns success when only fireAt is provided (schedule absent)', async () => {
    mockUpdate.mockResolvedValue({});

    const result = await updateCronJob({
      id: 'cj_1',
      fireAt: '2026-06-01T08:00:00.000Z',
    });

    expect(result).toEqual({ success: true });
  });

  it('returns error when name is provided but empty', async () => {
    const result = await updateCronJob({
      id: 'cj_1',
      name: '   ',
    });

    expect(result).toEqual({ error: 'Name is required' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns error when prompt is provided but empty', async () => {
    const result = await updateCronJob({
      id: 'cj_1',
      prompt: '   ',
    });

    expect(result).toEqual({ error: 'Prompt is required' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('does not call revalidatePath on validation error', async () => {
    await updateCronJob({ id: 'cj_1', name: '' });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns a duplicate-name error when prisma throws a Unique constraint error', async () => {
    mockUpdate.mockRejectedValue(new Error('Unique constraint failed on the fields: (`name`)'));

    const result = await updateCronJob({ id: 'cj_1', name: 'Existing Name' });

    expect(result).toEqual({
      error: `A cron job named "Existing Name" already exists`,
    });
  });

  it('returns a generic error when prisma throws an unexpected error', async () => {
    mockUpdate.mockRejectedValue(new Error('Database connection refused'));

    const result = await updateCronJob({ id: 'cj_1', enabled: true });

    expect(result).toEqual({ error: 'Failed to update cron job' });
  });

  it('trims the name before writing to the database', async () => {
    mockUpdate.mockResolvedValue({});

    await updateCronJob({ id: 'cj_1', name: '  Padded Name  ' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Padded Name' }),
      }),
    );
  });

  it('converts a non-null fireAt string to a Date object', async () => {
    mockUpdate.mockResolvedValue({});

    await updateCronJob({ id: 'cj_1', fireAt: '2026-06-01T08:00:00.000Z' });

    expect(mockUpdate).toHaveBeenCalledOnce();
    const callArg = mockUpdate.mock.calls[0]?.[0] as {
      data: { fireAt: unknown };
    };
    expect(callArg.data.fireAt).toBeInstanceOf(Date);
  });

  it('sets fireAt to null when a null fireAt is provided', async () => {
    mockUpdate.mockResolvedValue({});

    await updateCronJob({ id: 'cj_1', fireAt: null });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fireAt: null }),
      }),
    );
  });

  it('omits fields not present in the input from the update payload', async () => {
    mockUpdate.mockResolvedValue({});

    await updateCronJob({ id: 'cj_1', enabled: true });

    expect(mockUpdate).toHaveBeenCalledOnce();
    const callArg = mockUpdate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(callArg.data).not.toHaveProperty('name');
    expect(callArg.data).not.toHaveProperty('prompt');
    expect(callArg.data).not.toHaveProperty('schedule');
  });

  it('passes the correct where clause to prisma.cronJob.update', async () => {
    mockUpdate.mockResolvedValue({});

    await updateCronJob({ id: 'cj_target', enabled: false });

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'cj_target' } }));
  });

  it('allows update when both schedule and fireAt are present but exactly one is truthy', async () => {
    mockUpdate.mockResolvedValue({});

    const result = await updateCronJob({
      id: 'cj_1',
      schedule: '0 9 * * *',
      fireAt: null,
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('includes agentId in data when provided', async () => {
    mockUpdate.mockResolvedValue({});

    await updateCronJob({ id: 'cj_1', agentId: 'agent_new' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ agentId: 'agent_new' }),
      }),
    );
  });

  it('includes threadId as non-null string when provided', async () => {
    mockUpdate.mockResolvedValue({});

    await updateCronJob({ id: 'cj_1', threadId: 'thread_abc' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ threadId: 'thread_abc' }),
      }),
    );
  });

  it('includes projectId as non-null string when provided', async () => {
    mockUpdate.mockResolvedValue({});

    await updateCronJob({ id: 'cj_1', projectId: 'proj_xyz' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: 'proj_xyz' }),
      }),
    );
  });

  it('sets schedule to non-null value when schedule key is present', async () => {
    mockUpdate.mockResolvedValue({});

    await updateCronJob({ id: 'cj_1', schedule: '*/10 * * * *' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schedule: '*/10 * * * *' }),
      }),
    );
  });

  it('sets schedule to null when schedule key is present with null value', async () => {
    mockUpdate.mockResolvedValue({});

    await updateCronJob({ id: 'cj_1', schedule: null });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schedule: null }),
      }),
    );
  });

  it('returns generic error when a non-Error is thrown', async () => {
    mockUpdate.mockRejectedValue('some string error');

    const result = await updateCronJob({ id: 'cj_1', enabled: true });

    expect(result).toEqual({ error: 'Failed to update cron job' });
  });

  it('includes prompt in data when provided', async () => {
    mockUpdate.mockResolvedValue({});

    await updateCronJob({ id: 'cj_1', prompt: 'New prompt text' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ prompt: 'New prompt text' }),
      }),
    );
  });

  it('allows update with fireAt truthy and schedule null', async () => {
    mockUpdate.mockResolvedValue({});

    const result = await updateCronJob({
      id: 'cj_1',
      schedule: null,
      fireAt: '2026-06-01T08:00:00.000Z',
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalled();
  });
});
