import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    cronJob: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('../../_actions/toggle-cron-job', () => ({
  toggleCronJob: vi.fn(),
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
    mockFindMany.mockResolvedValue([]);
    const element = await CronJobsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No cron jobs configured.');
  });

  it('renders table with cron job data', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'cj_1',
        name: 'daily-summary',
        schedule: '0 9 * * *',
        prompt: 'Generate daily summary',
        enabled: true,
        lastRunAt: new Date('2026-02-23T09:00:00Z'),
        nextRunAt: new Date('2026-02-24T09:00:00Z'),
        threadId: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-02-23T09:00:00Z'),
      },
      {
        id: 'cj_2',
        name: 'weekly-cleanup',
        schedule: '0 0 * * 0',
        prompt: 'Clean up old threads',
        enabled: false,
        lastRunAt: null,
        nextRunAt: null,
        threadId: null,
        createdAt: new Date('2026-01-15T00:00:00Z'),
        updatedAt: new Date('2026-01-15T00:00:00Z'),
      },
    ]);
    const element = await CronJobsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('daily-summary');
    expect(html).toContain('0 9 * * *');
    expect(html).toContain('Enabled');
    expect(html).toContain('weekly-cleanup');
    expect(html).toContain('Disabled');
  });

  it('renders enable button for disabled jobs', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'cj_3',
        name: 'disabled-job',
        schedule: '*/5 * * * *',
        prompt: 'Test prompt',
        enabled: false,
        lastRunAt: null,
        nextRunAt: null,
        threadId: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const element = await CronJobsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Enable');
  });

  it('renders dash for null dates', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'cj_4',
        name: 'no-dates-job',
        schedule: '0 * * * *',
        prompt: 'Test',
        enabled: true,
        lastRunAt: null,
        nextRunAt: null,
        threadId: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const element = await CronJobsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('\u2014');
  });
});
