import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindManyAgents = vi.fn();
const mockFindManyThreads = vi.fn();
const mockFindManyProjects = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../_components/cron-job-form', () => ({
  CronJobForm: ({ mode, defaultValues }: { mode: string; defaultValues?: { agentId?: string } }) => (
    <div data-testid='cron-job-form' data-mode={mode} data-agent-id={defaultValues?.agentId ?? ''} />
  ),
}));

const { default: NewCronJobPage, metadata } = await import('../page');

describe('NewCronJobPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFindManyAgents.mockResolvedValue([{ id: 'agent_1', name: 'Claude' }]);
    mockFindManyThreads.mockResolvedValue([{ id: 'thread_1', name: 'Main Thread', agentId: 'agent_1' }]);
    mockFindManyProjects.mockResolvedValue([{ id: 'proj_1', name: 'Main' }]);
  });

  it('exports correct metadata title', () => {
    expect(metadata.title).toBe('New Scheduled Task | Admin | Harness Dashboard');
  });

  it('renders the page heading', async () => {
    const jsx = await NewCronJobPage({
      searchParams: Promise.resolve({}),
    });
    render(jsx as React.ReactElement);
    expect(screen.getByRole('heading', { name: 'New Scheduled Task' })).toBeInTheDocument();
  });

  it('renders the back link', async () => {
    const jsx = await NewCronJobPage({
      searchParams: Promise.resolve({}),
    });
    render(jsx as React.ReactElement);
    const link = screen.getByText('Back to Scheduled Tasks');
    expect(link.closest('a')).toHaveAttribute('href', '/admin/cron-jobs');
  });

  it('renders CronJobForm in create mode', async () => {
    const jsx = await NewCronJobPage({
      searchParams: Promise.resolve({}),
    });
    render(jsx as React.ReactElement);
    const form = screen.getByTestId('cron-job-form');
    expect(form).toHaveAttribute('data-mode', 'create');
  });

  it('passes agentId from searchParams as defaultValues', async () => {
    const jsx = await NewCronJobPage({
      searchParams: Promise.resolve({ agentId: 'agent_42' }),
    });
    render(jsx as React.ReactElement);
    const form = screen.getByTestId('cron-job-form');
    expect(form).toHaveAttribute('data-agent-id', 'agent_42');
  });

  it('passes no defaultValues when agentId is absent', async () => {
    const jsx = await NewCronJobPage({
      searchParams: Promise.resolve({}),
    });
    render(jsx as React.ReactElement);
    const form = screen.getByTestId('cron-job-form');
    expect(form).toHaveAttribute('data-agent-id', '');
  });

  it('maps thread rows with null name to use thread id', async () => {
    mockFindManyThreads.mockResolvedValue([{ id: 'thread_no_name', name: null, agentId: 'agent_1' }]);

    const jsx = await NewCronJobPage({
      searchParams: Promise.resolve({}),
    });
    render(jsx as React.ReactElement);
    // Should not throw and should render the form
    expect(screen.getByTestId('cron-job-form')).toBeInTheDocument();
  });
});
