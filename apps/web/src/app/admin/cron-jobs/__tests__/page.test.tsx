import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const { default: CronJobsPage, metadata } = await import('../page');

describe('CronJobsPage', () => {
  it('exports correct metadata title', () => {
    expect(metadata.title).toBe('Cron Jobs | Admin | Harness Dashboard');
  });

  it('exports correct metadata description', () => {
    expect(metadata.description).toBe('Manage scheduled orchestrator tasks.');
  });

  it('renders the page heading', () => {
    const html = renderToStaticMarkup(<CronJobsPage />);
    expect(html).toContain('Cron Jobs');
  });

  it('renders the description text', () => {
    const html = renderToStaticMarkup(<CronJobsPage />);
    expect(html).toContain('Manage scheduled orchestrator tasks.');
  });

  it('renders Suspense fallback skeleton', () => {
    const html = renderToStaticMarkup(<CronJobsPage />);
    expect(html).toContain('data-slot="skeleton"');
  });
});
