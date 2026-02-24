import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const { default: TasksPage, metadata } = await import('../page');

describe('TasksPage', () => {
  it('exports correct metadata title', () => {
    expect(metadata.title).toBe('Tasks | Admin | Harness Dashboard');
  });

  it('exports correct metadata description', () => {
    expect(metadata.description).toBe('View orchestrator task history and status.');
  });

  it('renders the page heading', () => {
    const html = renderToStaticMarkup(<TasksPage />);
    expect(html).toContain('Tasks');
  });

  it('renders the description text', () => {
    const html = renderToStaticMarkup(<TasksPage />);
    expect(html).toContain('View orchestrator task history and status.');
  });

  it('renders Suspense fallback skeleton', () => {
    const html = renderToStaticMarkup(<TasksPage />);
    expect(html).toContain('data-slot="skeleton"');
  });
});
