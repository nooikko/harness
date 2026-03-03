import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUniqueCronJob = vi.fn();
const mockFindManyAgents = vi.fn();
const mockFindManyThreads = vi.fn();
const mockFindManyProjects = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    cronJob: {
      findUnique: (...args: unknown[]) => mockFindUniqueCronJob(...args),
    },
    agent: {
      findMany: (...args: unknown[]) => mockFindManyAgents(...args),
    },
    thread: {
      findMany: (...args: unknown[]) => mockFindManyThreads(...args),
    },
    project: {
      findMany: (...args: unknown[]) => mockFindManyProjects(...args),
    },
  },
}));

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../../_components/cron-job-form', () => ({
  CronJobForm: ({ mode, defaultValues }: { mode: string; defaultValues?: { name?: string } }) => (
    <div data-testid='cron-job-form' data-mode={mode} data-name={defaultValues?.name ?? ''} />
  ),
}));

const { default: EditCronJobPage, generateMetadata } = await import('../page');

const makeParams = (id: string) => Promise.resolve({ id });

const fakeJob = {
  id: 'cj_1',
  name: 'Morning Digest',
  agentId: 'agent_1',
  threadId: 'thread_1',
  projectId: 'proj_1',
  schedule: '0 14 * * *',
  fireAt: null as Date | null,
  prompt: 'Summarize the day',
  enabled: true,
};

const fakeAgents = [{ id: 'agent_1', name: 'Claude' }];
const fakeProjects = [{ id: 'proj_1', name: 'Main' }];

describe('EditCronJobPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFindManyAgents.mockResolvedValue(fakeAgents);
    mockFindManyThreads.mockResolvedValue([{ id: 'thread_1', name: 'Main Thread', agentId: 'agent_1' }]);
    mockFindManyProjects.mockResolvedValue(fakeProjects);
  });

  it('calls notFound when job does not exist', async () => {
    mockFindUniqueCronJob.mockResolvedValue(null);

    await expect(EditCronJobPage({ params: makeParams('missing') })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });

  it('renders the job name as heading', async () => {
    mockFindUniqueCronJob.mockResolvedValue(fakeJob);

    const jsx = await EditCronJobPage({ params: makeParams('cj_1') });
    render(jsx as React.ReactElement);

    expect(screen.getByRole('heading', { name: /Edit: Morning Digest/ })).toBeInTheDocument();
  });

  it('renders the CronJobForm in edit mode', async () => {
    mockFindUniqueCronJob.mockResolvedValue(fakeJob);

    const jsx = await EditCronJobPage({ params: makeParams('cj_1') });
    render(jsx as React.ReactElement);

    const form = screen.getByTestId('cron-job-form');
    expect(form).toHaveAttribute('data-mode', 'edit');
    expect(form).toHaveAttribute('data-name', 'Morning Digest');
  });

  it('renders a back link to cron jobs list', async () => {
    mockFindUniqueCronJob.mockResolvedValue(fakeJob);

    const jsx = await EditCronJobPage({ params: makeParams('cj_1') });
    render(jsx as React.ReactElement);

    const link = screen.getByText('Back to Scheduled Tasks');
    expect(link.closest('a')).toHaveAttribute('href', '/admin/cron-jobs');
  });

  it('converts fireAt to ISO string when present', async () => {
    const jobWithFireAt = {
      ...fakeJob,
      schedule: null,
      fireAt: new Date('2026-06-01T10:00:00Z'),
    };
    mockFindUniqueCronJob.mockResolvedValue(jobWithFireAt);

    // Should not throw
    const jsx = await EditCronJobPage({ params: makeParams('cj_1') });
    render(jsx as React.ReactElement);

    expect(screen.getByTestId('cron-job-form')).toBeInTheDocument();
  });
});

describe('generateMetadata', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns title with job name when job exists', async () => {
    mockFindUniqueCronJob.mockResolvedValue({ name: 'Morning Digest' });

    const metadata = await generateMetadata({
      params: makeParams('cj_1'),
    });

    expect(metadata.title).toBe('Edit Morning Digest | Admin | Harness Dashboard');
  });

  it("returns 'Job Not Found' title when job does not exist", async () => {
    mockFindUniqueCronJob.mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: makeParams('missing'),
    });

    expect(metadata.title).toBe('Job Not Found');
  });
});
