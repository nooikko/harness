import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const { default: ThreadsPage, metadata } = await import('../page');

describe('ThreadsPage', () => {
  it('exports correct metadata title', () => {
    expect(metadata.title).toBe('Threads | Admin | Harness Dashboard');
  });

  it('exports correct metadata description', () => {
    expect(metadata.description).toBe('View and manage all conversation threads.');
  });

  it('renders the page heading', () => {
    const html = renderToStaticMarkup(<ThreadsPage />);
    expect(html).toContain('Threads');
  });

  it('renders the description text', () => {
    const html = renderToStaticMarkup(<ThreadsPage />);
    expect(html).toContain('View and manage all conversation threads.');
  });

  it('renders Suspense fallback skeleton', () => {
    const html = renderToStaticMarkup(<ThreadsPage />);
    expect(html).toContain('data-slot="skeleton"');
  });
});
