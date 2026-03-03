import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockRevalidatePath = vi.fn();
const mockNotifyCronReload = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    cronJob: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('../_helpers/notify-cron-reload', () => ({
  notifyCronReload: () => mockNotifyCronReload(),
}));

const { createCronJob } = await import('../create-cron-job');

const validRecurringInput = {
  name: 'Daily Digest',
  agentId: 'agent_1',
  schedule: '0 9 * * *',
  prompt: 'Summarize activity from the last 24 hours.',
};

const validOneShotInput = {
  name: 'One-time Report',
  agentId: 'agent_1',
  fireAt: '2026-04-01T10:00:00.000Z',
  prompt: 'Generate a quarterly report.',
};

describe('createCronJob', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockNotifyCronReload.mockResolvedValue(undefined);
  });

  it('returns success with id on a valid recurring job (schedule set, no fireAt)', async () => {
    mockCreate.mockResolvedValue({ id: 'cj_recurring' });

    const result = await createCronJob(validRecurringInput);

    expect(result).toEqual({ success: true, id: 'cj_recurring' });
  });

  it('returns success with id on a valid one-shot job (fireAt set, no schedule)', async () => {
    mockCreate.mockResolvedValue({ id: 'cj_oneshot' });

    const result = await createCronJob(validOneShotInput);

    expect(result).toEqual({ success: true, id: 'cj_oneshot' });
  });

  it('returns error when both schedule and fireAt are set', async () => {
    const result = await createCronJob({
      name: 'Bad Job',
      agentId: 'agent_1',
      schedule: '0 9 * * *',
      fireAt: '2026-04-01T10:00:00.000Z',
      prompt: 'Do something.',
    });

    expect(result).toEqual({
      error: 'Exactly one of schedule or fireAt must be set, not both',
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns error when neither schedule nor fireAt is set', async () => {
    const result = await createCronJob({
      name: 'Bad Job',
      agentId: 'agent_1',
      prompt: 'Do something.',
    });

    expect(result).toEqual({
      error: 'Exactly one of schedule or fireAt must be set, not both',
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns error when name is empty', async () => {
    const result = await createCronJob({
      ...validRecurringInput,
      name: '   ',
    });

    expect(result).toEqual({ error: 'Name is required' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns error when prompt is empty', async () => {
    const result = await createCronJob({
      ...validRecurringInput,
      prompt: '   ',
    });

    expect(result).toEqual({ error: 'Prompt is required' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('calls revalidatePath on success', async () => {
    mockCreate.mockResolvedValue({ id: 'cj_path' });

    await createCronJob(validRecurringInput);

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/cron-jobs');
  });

  it('does not call revalidatePath on validation error', async () => {
    await createCronJob({
      name: '',
      agentId: 'agent_1',
      prompt: 'Do something.',
    });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('calls notifyCronReload after a successful create', async () => {
    mockCreate.mockResolvedValue({ id: 'cj_notify' });

    await createCronJob(validRecurringInput);

    expect(mockNotifyCronReload).toHaveBeenCalledOnce();
  });

  it('does not call notifyCronReload on validation error', async () => {
    await createCronJob({
      name: '',
      agentId: 'agent_1',
      prompt: 'Do something.',
    });

    expect(mockNotifyCronReload).not.toHaveBeenCalled();
  });

  it('does not call notifyCronReload when prisma throws', async () => {
    mockCreate.mockRejectedValue(new Error('Database connection refused'));

    await createCronJob(validRecurringInput);

    expect(mockNotifyCronReload).not.toHaveBeenCalled();
  });

  it('returns a duplicate-name error when prisma throws a Unique constraint error', async () => {
    mockCreate.mockRejectedValue(new Error('Unique constraint failed on the fields: (`name`)'));

    const result = await createCronJob(validRecurringInput);

    expect(result).toEqual({
      error: `A cron job named "Daily Digest" already exists`,
    });
  });

  it('returns a generic error when prisma throws an unexpected error', async () => {
    mockCreate.mockRejectedValue(new Error('Database connection refused'));

    const result = await createCronJob(validRecurringInput);

    expect(result).toEqual({ error: 'Failed to create cron job' });
  });

  it('passes the correct data shape to prisma.cronJob.create', async () => {
    mockCreate.mockResolvedValue({ id: 'cj_shape' });

    await createCronJob({
      name: '  Trimmed Name  ',
      agentId: 'agent_abc',
      threadId: 'thread_1',
      projectId: 'proj_1',
      schedule: '*/5 * * * *',
      prompt: 'Check status.',
      enabled: false,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: 'Trimmed Name',
        agentId: 'agent_abc',
        threadId: 'thread_1',
        projectId: 'proj_1',
        schedule: '*/5 * * * *',
        fireAt: null,
        prompt: 'Check status.',
        enabled: false,
      },
    });
  });

  it('defaults enabled to true and nullable fields to null when omitted', async () => {
    mockCreate.mockResolvedValue({ id: 'cj_defaults' });

    await createCronJob(validRecurringInput);

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        enabled: true,
        threadId: null,
        projectId: null,
        fireAt: null,
      }),
    });
  });

  it('converts fireAt string to a Date object', async () => {
    mockCreate.mockResolvedValue({ id: 'cj_date' });

    await createCronJob(validOneShotInput);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArg = mockCreate.mock.calls[0]?.[0] as {
      data: { fireAt: unknown };
    };
    expect(callArg.data.fireAt).toBeInstanceOf(Date);
  });
});
