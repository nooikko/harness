import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockListCronJobs = vi.fn();

vi.mock('../../_actions/list-cron-jobs', () => ({
  listCronJobs: (...args: unknown[]) => mockListCronJobs(...args),
}));

vi.mock('../../_actions/toggle-cron-job', () => ({
  toggleCronJob: vi.fn(),
}));

vi.mock('../../_actions/delete-cron-job', () => ({
  deleteCronJob: vi.fn(),
}));

vi.mock('../cron-job-toggle', () => ({
  CronJobToggle: ({ id, enabled }: { id: string; enabled: boolean }) => (
    <span data-testid='cron-toggle' data-id={id} data-enabled={enabled}>
      {enabled ? 'on' : 'off'}
    </span>
  ),
}));

vi.mock('../../../_components/relative-time', () => ({
  RelativeTime: ({ date }: { date: Date }) => <time>{date.toISOString()}</time>,
}));

vi.mock('../../../_components/row-menu', () => ({
  RowMenu: ({ actions }: { actions: Array<{ label: string }> }) => (
    <div data-testid='row-menu'>
      {actions.map((a) => (
        <span key={a.label}>{a.label}</span>
      ))}
    </div>
  ),
}));

const { CronJobsTable, CronJobsTableInternal } = await import('../cron-jobs-table');

describe('CronJobsTable', () => {
  it('renders a Suspense fallback skeleton', () => {
    const element = CronJobsTable();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});

describe('CronJobsTableInternal', () => {
  it('renders empty state when no jobs exist', async () => {
    mockListCronJobs.mockResolvedValue([]);
    const element = await CronJobsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No scheduled tasks yet');
    expect(html).toContain('New Task');
  });

  it('renders table with recurring job data', async () => {
    mockListCronJobs.mockResolvedValue([
      {
        id: 'cj_1',
        name: 'daily-summary',
        schedule: '0 9 * * *',
        fireAt: null,
        prompt: 'Generate daily summary',
        enabled: true,
        lastRunAt: new Date('2026-02-23T09:00:00Z'),
        nextRunAt: new Date('2026-02-24T09:00:00Z'),
        threadId: 'th_1',
        threadName: 'Summary Thread',
        agentName: 'Claude',
        projectName: 'Main',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-02-23T09:00:00Z'),
      },
    ]);
    const element = await CronJobsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('daily-summary');
    expect(html).toContain('0 9 * * *');
    expect(html).toContain('Claude');
    expect(html).toContain('Edit');
    expect(html).toContain('Delete');
  });

  it('renders inline toggle for enabled state', async () => {
    mockListCronJobs.mockResolvedValue([
      {
        id: 'cj_toggle',
        name: 'toggle-test',
        schedule: '0 * * * *',
        fireAt: null,
        prompt: 'Test',
        enabled: true,
        lastRunAt: null,
        nextRunAt: null,
        threadId: null,
        threadName: null,
        agentName: 'Agent',
        projectName: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const element = await CronJobsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-testid="cron-toggle"');
    expect(html).toContain('data-enabled="true"');
  });

  it('renders one-shot job with fireAt date', async () => {
    mockListCronJobs.mockResolvedValue([
      {
        id: 'cj_2',
        name: 'one-time-task',
        schedule: null,
        fireAt: new Date('2026-03-15T14:00:00Z'),
        prompt: 'Run once',
        enabled: true,
        lastRunAt: null,
        nextRunAt: new Date('2026-03-15T14:00:00Z'),
        threadId: null,
        threadName: null,
        agentName: 'Bot',
        projectName: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const element = await CronJobsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Mar');
    expect(html).toContain('15');
  });

  it('renders disabled job with toggle off', async () => {
    mockListCronJobs.mockResolvedValue([
      {
        id: 'cj_3',
        name: 'disabled-job',
        schedule: '*/5 * * * *',
        fireAt: null,
        prompt: 'Test prompt',
        enabled: false,
        lastRunAt: null,
        nextRunAt: null,
        threadId: null,
        threadName: null,
        agentName: 'Agent',
        projectName: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const element = await CronJobsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-enabled="false"');
    expect(html).toContain('off');
  });

  it('shows dash when lastRunAt is null', async () => {
    mockListCronJobs.mockResolvedValue([
      {
        id: 'cj_4',
        name: 'no-dates-job',
        schedule: '0 * * * *',
        fireAt: null,
        prompt: 'Test',
        enabled: true,
        lastRunAt: null,
        nextRunAt: null,
        threadId: null,
        threadName: null,
        agentName: 'Agent',
        projectName: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const element = await CronJobsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('no-dates-job');
    expect(html).toContain('0 * * * *');
    expect(html).toContain('\u2014');
  });

  it('renders edit link to cron job edit page', async () => {
    mockListCronJobs.mockResolvedValue([
      {
        id: 'cj_edit',
        name: 'edit-test',
        schedule: '0 0 * * *',
        fireAt: null,
        prompt: 'Test',
        enabled: true,
        lastRunAt: null,
        nextRunAt: null,
        threadId: null,
        threadName: null,
        agentName: 'Agent',
        projectName: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const element = await CronJobsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('/admin/cron-jobs/cj_edit/edit');
  });
});
